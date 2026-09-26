import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getDb, closeDb } from './connection.js';
import { runMigrations } from './migrate.js';
import type { Role, Sex } from '../types.js';

interface SeedUser {
  name: string;
  email: string;
  role: Role;
}

// Un compte par rôle. ACCUEIL (secrétariat) < SOIGNANT (infirmier/médecin) < ADMIN.
const seedUsers: SeedUser[] = [
  { name: 'Accueil Démo', email: 'accueil@clinique.local', role: 'ACCUEIL' },
  { name: 'Dr. Soignant Démo', email: 'soignant@clinique.local', role: 'SOIGNANT' },
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
  { first_name: 'Jean', last_name: 'Mbarga', sex: 'M', birth_date: '1978-11-03', phone: '691000002', address: 'Douala, Akwa', blood_group: 'A+', allergies: null },
  { first_name: 'Fatou', last_name: 'Bello', sex: 'F', birth_date: '2015-06-21', phone: '692000003', address: 'Garoua, Plateau', blood_group: 'B+', allergies: 'Arachide' },
  { first_name: 'Paul', last_name: 'Etoa', sex: 'M', birth_date: '1955-01-30', phone: '693000004', address: 'Bafoussam, Centre', blood_group: 'AB+', allergies: null },
];

export function seed(): void {
  const db = getDb();
  runMigrations(db);

  const passwordHash = bcrypt.hashSync(config.seedDefaultPassword, 10);

  const upsert = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, active)
    VALUES (@name, @email, @passwordHash, @role, 1)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      password_hash = excluded.password_hash,
      active = 1
  `);
  db.transaction((users: SeedUser[]) => {
    for (const u of users) upsert.run({ ...u, passwordHash });
  })(seedUsers);

  console.log('Seeded users (password for all: from SEED_DEFAULT_PASSWORD):');
  for (const u of seedUsers) console.log(`  - ${u.role.padEnd(9)} ${u.email}`);

  seedDemoData();
}

function seedDemoData(): void {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n;
  if (count > 0) {
    console.log('Patients already present — skipping demo data.');
    return;
  }

  const soignant = db.prepare("SELECT id FROM users WHERE role='SOIGNANT' LIMIT 1").get() as
    | { id: number }
    | undefined;
  const accueil = db.prepare("SELECT id FROM users WHERE role='ACCUEIL' LIMIT 1").get() as
    | { id: number }
    | undefined;
  const soignantId = soignant?.id ?? 1;
  const accueilId = accueil?.id ?? 1;

  const insertPatient = db.prepare(
    `INSERT INTO patients (first_name, last_name, sex, birth_date, phone, address, blood_group, allergies)
     VALUES (@first_name, @last_name, @sex, @birth_date, @phone, @address, @blood_group, @allergies)`,
  );

  const seedAll = db.transaction(() => {
    const ids: number[] = [];
    for (const p of demoPatients) {
      const info = insertPatient.run(p);
      const id = Number(info.lastInsertRowid);
      db.prepare('UPDATE patients SET code = ? WHERE id = ?').run(patientCode(id), id);
      ids.push(id);
    }

    // Une consultation pour le premier patient.
    db.prepare(
      `INSERT INTO consultations
        (patient_id, user_id, motif, symptoms, diagnosis, treatment, weight_kg, temperature_c, bp_systolic, bp_diastolic, pulse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      ids[0],
      soignantId,
      'Fièvre et fatigue',
      'Fièvre depuis 3 jours, céphalées',
      'Paludisme simple',
      'Coartem 80/480, 1 cp x2/j pendant 3 jours. Paracétamol si fièvre.',
      64,
      38.7,
      120,
      80,
      88,
    );

    // File d'attente du jour : deux patients en attente.
    const now = new Date();
    const at = (h: number, m: number) => {
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      const off = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - off).toISOString();
    };
    db.prepare(
      'INSERT INTO appointments (patient_id, scheduled_at, reason, status, user_id) VALUES (?, ?, ?, ?, ?)',
    ).run(ids[1], at(9, 0), 'Contrôle tension', 'EN_ATTENTE', accueilId);
    db.prepare(
      'INSERT INTO appointments (patient_id, scheduled_at, reason, status, user_id) VALUES (?, ?, ?, ?, ?)',
    ).run(ids[2], at(9, 30), 'Vaccination', 'PLANIFIE', accueilId);

    // Une facture pour le premier patient, partiellement payée.
    const inv = db
      .prepare('INSERT INTO invoices (patient_id, user_id, note) VALUES (?, ?, ?)')
      .run(ids[0], accueilId, 'Consultation + médicaments');
    const invId = Number(inv.lastInsertRowid);
    db.prepare('UPDATE invoices SET code = ? WHERE id = ?').run(invoiceCode(invId), invId);
    const item = db.prepare(
      'INSERT INTO invoice_items (invoice_id, label, quantity, unit_price) VALUES (?, ?, ?, ?)',
    );
    item.run(invId, 'Consultation médicale', 1, 2000);
    item.run(invId, 'Coartem 80/480', 1, 1500);
    db.prepare('INSERT INTO payments (invoice_id, amount, method, user_id) VALUES (?, ?, ?, ?)').run(
      invId,
      2000,
      'ESPECES',
      accueilId,
    );
  });
  seedAll();
  console.log(`Seeded ${demoPatients.length} demo patients with a consultation, queue and invoice.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
  closeDb();
}
