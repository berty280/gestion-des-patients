import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getDb, closeDb } from './connection.js';
import { runMigrations } from './migrate.js';
import { PATHOLOGIES } from './pathologies.data.js';
import type { Role, Sex, Specialty } from '../types.js';

interface SeedUser {
  name: string;
  email: string;
  role: Role;
  specialty?: Specialty;
  // Jours de prestation (0=dimanche … 6=samedi) pour les spécialistes.
  days?: number[];
}

const seedUsers: SeedUser[] = [
  { name: 'Accueil Démo', email: 'accueil@clinique.local', role: 'ACCUEIL' },
  { name: 'Dr. Paul Généraliste', email: 'generaliste@clinique.local', role: 'GENERALISTE' },
  { name: 'Dr. Fanny Généraliste', email: 'generaliste2@clinique.local', role: 'GENERALISTE' },
  { name: 'M. Kiné (Kinésithérapie)', email: 'kine@clinique.local', role: 'SPECIALISTE', specialty: 'KINE', days: [1, 3] },
  { name: 'Dr. Ophtalmologue', email: 'ophtalmo@clinique.local', role: 'SPECIALISTE', specialty: 'OPHTALMOLOGIE', days: [2] },
  { name: 'Dr. Dermatologue', email: 'dermato@clinique.local', role: 'SPECIALISTE', specialty: 'DERMATOLOGIE', days: [4] },
  { name: 'Dr. Gynécologue', email: 'gyneco@clinique.local', role: 'SPECIALISTE', specialty: 'GYNECOLOGIE', days: [1, 5] },
  { name: 'Dr. Radiologue', email: 'radiologue@clinique.local', role: 'SPECIALISTE', specialty: 'RADIOLOGIE', days: [3, 5] },
  { name: 'Admin Démo', email: 'admin@clinique.local', role: 'ADMIN' },
];

function patientCode(id: number): string {
  return `P-${String(id).padStart(5, '0')}`;
}
function invoiceCode(id: number): string {
  return `F-${String(id).padStart(5, '0')}`;
}

interface DemoPatient {
  first_name: string;
  last_name: string;
  sex: Sex;
  birth_date: string;
  phone: string;
  address: string;
  blood_group: string;
  allergies: string | null;
}

const demoPatients: DemoPatient[] = [
  { first_name: 'Awa', last_name: 'Ngono', sex: 'F', birth_date: '1990-04-12', phone: '690000001', address: 'Yaoundé, Mvog-Ada', blood_group: 'O+', allergies: 'Pénicilline' },
  { first_name: 'Jean', last_name: 'Mbarga', sex: 'M', birth_date: '1978-11-03', phone: '691000002', address: 'Yaoundé, Nsam', blood_group: 'A+', allergies: null },
  { first_name: 'Fatou', last_name: 'Bello', sex: 'F', birth_date: '2015-06-21', phone: '692000003', address: 'Yaoundé, Biyem-Assi', blood_group: 'B+', allergies: 'Arachide' },
  { first_name: 'Paul', last_name: 'Etoa', sex: 'M', birth_date: '1955-01-30', phone: '693000004', address: 'Yaoundé, Nkolbisson', blood_group: 'AB+', allergies: null },
];

export function seed(): void {
  const db = getDb();
  runMigrations(db);

  const passwordHash = bcrypt.hashSync(config.seedDefaultPassword, 10);

  const upsert = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, specialty, active)
    VALUES (@name, @email, @passwordHash, @role, @specialty, 1)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      specialty = excluded.specialty,
      password_hash = excluded.password_hash,
      active = 1
  `);
  db.transaction((users: SeedUser[]) => {
    for (const u of users) {
      upsert.run({ ...u, specialty: u.specialty ?? null, passwordHash });
    }
  })(seedUsers);

  console.log('Seeded users (password for all: from SEED_DEFAULT_PASSWORD):');
  for (const u of seedUsers) {
    console.log(`  - ${u.role.padEnd(11)} ${u.email}${u.specialty ? ` (${u.specialty})` : ''}`);
  }

  seedSchedules();
  seedPathologies();
  seedDemoData();
}

/** Calendrier hebdomadaire des spécialistes (idempotent : reconstruit à chaque seed). */
function seedSchedules(): void {
  const db = getDb();
  const insert = db.prepare(
    'INSERT INTO specialist_schedules (user_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)',
  );
  db.transaction(() => {
    for (const u of seedUsers) {
      if (u.role !== 'SPECIALISTE' || !u.days) continue;
      const row = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email) as
        | { id: number }
        | undefined;
      if (!row) continue;
      db.prepare('DELETE FROM specialist_schedules WHERE user_id = ?').run(row.id);
      for (const d of u.days) insert.run(row.id, d, '08:00', '16:00');
    }
  })();
}

/** Catalogue des pathologies (n'insère que ce qui manque). */
function seedPathologies(): void {
  const db = getDb();
  const insert = db.prepare('INSERT INTO pathologies (specialty, code, label) VALUES (?, ?, ?)');
  let added = 0;
  db.transaction(() => {
    for (const [specialty, list] of Object.entries(PATHOLOGIES)) {
      for (const p of list) {
        const exists = db
          .prepare('SELECT id FROM pathologies WHERE specialty = ? AND code = ?')
          .get(specialty, p.code);
        if (!exists) {
          insert.run(specialty, p.code, p.label);
          added++;
        }
      }
    }
  })();
  if (added > 0) console.log(`Seeded ${added} pathologies (CIM-10).`);
}

function seedDemoData(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n;
  if (count > 0) {
    console.log('Patients already present — skipping demo data.');
    return;
  }

  const uid = (email: string) =>
    (db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number }).id;
  const generalisteId = uid('generaliste@clinique.local');
  const gynecoId = uid('gyneco@clinique.local');
  const accueilId = uid('accueil@clinique.local');

  const insertPatient = db.prepare(
    `INSERT INTO patients (first_name, last_name, sex, birth_date, phone, address, blood_group, allergies)
     VALUES (@first_name, @last_name, @sex, @birth_date, @phone, @address, @blood_group, @allergies)`,
  );

  db.transaction(() => {
    const ids: number[] = [];
    for (const p of demoPatients) {
      const info = insertPatient.run(p);
      const id = Number(info.lastInsertRowid);
      db.prepare('UPDATE patients SET code = ? WHERE id = ?').run(patientCode(id), id);
      ids.push(id);
    }

    // Consultation générale pour Awa Ngono, avec pathologie, prescription, examen et référence gynéco.
    const cInfo = db
      .prepare(
        `INSERT INTO consultations
          (patient_id, user_id, type, motif, symptoms, weight_kg, height_cm, temperature_c,
           bp_systolic, bp_diastolic, pulse, diagnosis, summary)
         VALUES (?, ?, 'GENERALE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ids[0],
        generalisteId,
        'Douleurs pelviennes',
        'Douleurs pelviennes basses depuis 1 semaine, cycles irréguliers',
        64,
        165,
        37.8,
        120,
        80,
        84,
        'Suspicion d’affection gynécologique',
        'Patiente stable. Prescription antalgique, bilan et orientation vers la gynécologie.',
      );
    const consultId = Number(cInfo.lastInsertRowid);

    const patho = db
      .prepare("SELECT id FROM pathologies WHERE specialty='GENERAL' AND code='R51' LIMIT 1")
      .get() as { id: number } | undefined;
    if (patho) {
      db.prepare(
        'INSERT INTO consultation_pathologies (consultation_id, pathology_id) VALUES (?, ?)',
      ).run(consultId, patho.id);
    }

    db.prepare(
      `INSERT INTO prescriptions (consultation_id, patient_id, medication, dosage, frequency, duration)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(consultId, ids[0], 'Paracétamol 500 mg', '1 comprimé', '3 fois par jour', '5 jours');

    db.prepare(
      `INSERT INTO exam_orders (consultation_id, patient_id, category, label)
       VALUES (?, ?, 'LABORATOIRE', ?)`,
    ).run(consultId, ids[0], 'NFS + CRP');

    // Référence vers la gynécologue + rendez-vous le prochain jour de prestation.
    const refInfo = db
      .prepare(
        `INSERT INTO referrals (patient_id, from_user_id, consultation_id, to_specialty, to_user_id, indications, status)
         VALUES (?, ?, ?, 'GYNECOLOGIE', ?, ?, 'PLANIFIE')`,
      )
      .run(
        ids[0],
        generalisteId,
        consultId,
        gynecoId,
        'Douleurs pelviennes + cycles irréguliers. Merci d’évaluer (échographie pelvienne si besoin).',
      );
    const referralId = Number(refInfo.lastInsertRowid);

    // Prochain vendredi (jour de prestation de la gynéco) à 09:00.
    const next = new Date();
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() !== 5);
    next.setHours(9, 0, 0, 0);
    const off = next.getTimezoneOffset() * 60000;
    const scheduledAt = new Date(next.getTime() - off).toISOString();

    const apptInfo = db
      .prepare(
        `INSERT INTO appointments (patient_id, scheduled_at, reason, status, user_id, assigned_user_id, specialty, referral_id)
         VALUES (?, ?, ?, 'PLANIFIE', ?, ?, 'GYNECOLOGIE', ?)`,
      )
      .run(ids[0], scheduledAt, 'Consultation gynécologique (référée)', accueilId, gynecoId, referralId);
    db.prepare('UPDATE referrals SET appointment_id = ? WHERE id = ?').run(
      Number(apptInfo.lastInsertRowid),
      referralId,
    );

    // File d'attente généraliste du jour.
    const nowIso = () => {
      const d = new Date();
      d.setHours(9, 30, 0, 0);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    };
    db.prepare(
      'INSERT INTO appointments (patient_id, scheduled_at, reason, status, user_id) VALUES (?, ?, ?, ?, ?)',
    ).run(ids[1], nowIso(), 'Contrôle tension', 'EN_ATTENTE', accueilId);

    // Facture partiellement payée pour Awa.
    const inv = db
      .prepare('INSERT INTO invoices (patient_id, consultation_id, user_id, note) VALUES (?, ?, ?, ?)')
      .run(ids[0], consultId, accueilId, 'Consultation + médicaments');
    const invId = Number(inv.lastInsertRowid);
    db.prepare('UPDATE invoices SET code = ? WHERE id = ?').run(invoiceCode(invId), invId);
    const item = db.prepare(
      'INSERT INTO invoice_items (invoice_id, label, quantity, unit_price) VALUES (?, ?, ?, ?)',
    );
    item.run(invId, 'Consultation générale', 1, 2000);
    item.run(invId, 'Paracétamol 500 mg', 1, 500);
    db.prepare('INSERT INTO payments (invoice_id, amount, method, user_id) VALUES (?, ?, ?, ?)').run(
      invId,
      2000,
      'ESPECES',
      accueilId,
    );
  })();
  console.log(`Seeded ${demoPatients.length} demo patients with consultation, referral, appointment and invoice.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
  closeDb();
}
