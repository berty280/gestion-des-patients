import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { conflict, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { PatientRow } from '../types.js';

const patientBody = z.object({
  first_name: z.string().trim().min(1).max(120),
  last_name: z.string().trim().min(1).max(120),
  sex: z.enum(['M', 'F']).nullish(),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
    .nullish(),
  phone: z.string().trim().max(50).nullish(),
  address: z.string().trim().max(300).nullish(),
  blood_group: z.string().trim().max(10).nullish(),
  allergies: z.string().trim().max(500).nullish(),
  emergency_contact: z.string().trim().max(200).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

/** Human-readable patient file number, e.g. P-00042. */
function patientCode(id: number): string {
  return `P-${String(id).padStart(5, '0')}`;
}

export async function patientRoutes(app: FastifyInstance): Promise<void> {
  // Dossiers patients — consultation/lecture par tous les rôles.
  app.get('/patients', { preHandler: [app.authenticate] }, async (req) => {
    const { q } = req.query as { q?: string };
    const db = getDb();
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      return db
        .prepare(
          `SELECT * FROM patients
           WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR code LIKE ?
           ORDER BY last_name, first_name LIMIT 200`,
        )
        .all(like, like, like, like);
    }
    return db.prepare('SELECT * FROM patients ORDER BY created_at DESC LIMIT 200').all();
  });

  // Identification d'un patient par (nom + date de naissance) ou par téléphone.
  app.get('/patients/identify', { preHandler: [app.authenticate] }, async (req) => {
    const { last_name, birth_date, phone } = req.query as {
      last_name?: string;
      birth_date?: string;
      phone?: string;
    };
    const db = getDb();
    if (phone && phone.trim()) {
      return db
        .prepare('SELECT * FROM patients WHERE phone = ? ORDER BY last_name, first_name LIMIT 50')
        .all(phone.trim());
    }
    if (last_name && last_name.trim() && birth_date && /^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      return db
        .prepare(
          'SELECT * FROM patients WHERE lower(last_name) = lower(?) AND birth_date = ? ORDER BY first_name LIMIT 50',
        )
        .all(last_name.trim(), birth_date);
    }
    return [];
  });

  app.get('/patients/:id', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(Number(id)) as
      | PatientRow
      | undefined;
    if (!row) throw notFound('Patient introuvable');

    const consultations = (
      db.prepare('SELECT COUNT(*) AS n FROM consultations WHERE patient_id = ?').get(row.id) as {
        n: number;
      }
    ).n;
    const lastVisit = db
      .prepare('SELECT MAX(created_at) AS d FROM consultations WHERE patient_id = ?')
      .get(row.id) as { d: string | null };

    return { ...row, consultations_count: consultations, last_visit: lastVisit.d };
  });

  // Dossier numérique complet (médical) — réservé au personnel médical.
  app.get(
    '/patients/:id/record',
    { preHandler: [app.authenticate, app.requireMedecin] },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const pid = Number(id);
      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(pid) as
        | PatientRow
        | undefined;
      if (!patient) throw notFound('Patient introuvable');

      const consultations = db
        .prepare(
          `SELECT c.*, u.name AS user_name
           FROM consultations c LEFT JOIN users u ON u.id = c.user_id
           WHERE c.patient_id = ? ORDER BY c.created_at DESC`,
        )
        .all(pid) as Array<{ id: number }>;

      // Rattache pathologies / prescriptions / examens à chaque consultation.
      const pathoStmt = db.prepare(
        `SELECT pa.* FROM consultation_pathologies cp
         JOIN pathologies pa ON pa.id = cp.pathology_id
         WHERE cp.consultation_id = ? ORDER BY pa.code`,
      );
      const presStmt = db.prepare('SELECT * FROM prescriptions WHERE consultation_id = ? ORDER BY id');
      const examStmt = db.prepare('SELECT * FROM exam_orders WHERE consultation_id = ? ORDER BY id');
      const fullConsultations = consultations.map((c) => ({
        ...c,
        pathologies: pathoStmt.all(c.id),
        prescriptions: presStmt.all(c.id),
        exams: examStmt.all(c.id),
      }));

      const referrals = db
        .prepare(
          `SELECT r.*, fu.name AS from_user_name, tu.name AS to_user_name, a.scheduled_at AS appointment_at
           FROM referrals r
           LEFT JOIN users fu ON fu.id = r.from_user_id
           LEFT JOIN users tu ON tu.id = r.to_user_id
           LEFT JOIN appointments a ON a.id = r.appointment_id
           WHERE r.patient_id = ? ORDER BY r.created_at DESC`,
        )
        .all(pid);
      const prescriptions = db
        .prepare('SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC')
        .all(pid);
      const exams = db
        .prepare('SELECT * FROM exam_orders WHERE patient_id = ? ORDER BY created_at DESC')
        .all(pid);

      return { patient, consultations: fullConsultations, referrals, prescriptions, exams };
    },
  );

  app.post('/patients', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = parse(patientBody, req.body);
    const db = getDb();
    const insert = db.prepare(
      `INSERT INTO patients
        (first_name, last_name, sex, birth_date, phone, address, blood_group, allergies, emergency_contact, notes)
       VALUES (@first_name, @last_name, @sex, @birth_date, @phone, @address, @blood_group, @allergies, @emergency_contact, @notes)`,
    );
    const create = db.transaction(() => {
      const info = insert.run({
        first_name: body.first_name,
        last_name: body.last_name,
        sex: body.sex ?? null,
        birth_date: body.birth_date ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        blood_group: body.blood_group ?? null,
        allergies: body.allergies ?? null,
        emergency_contact: body.emergency_contact ?? null,
        notes: body.notes ?? null,
      });
      const newId = Number(info.lastInsertRowid);
      db.prepare('UPDATE patients SET code = ? WHERE id = ?').run(patientCode(newId), newId);
      return newId;
    });
    const newId = create();
    reply.code(201);
    return db.prepare('SELECT * FROM patients WHERE id = ?').get(newId);
  });

  app.patch('/patients/:id', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(patientBody.partial(), req.body);
    const db = getDb();
    const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(Number(id)) as
      | PatientRow
      | undefined;
    if (!existing) throw notFound('Patient introuvable');
    const m = { ...existing, ...body };
    db.prepare(
      `UPDATE patients SET
        first_name = ?, last_name = ?, sex = ?, birth_date = ?, phone = ?, address = ?,
        blood_group = ?, allergies = ?, emergency_contact = ?, notes = ?
       WHERE id = ?`,
    ).run(
      m.first_name,
      m.last_name,
      m.sex ?? null,
      m.birth_date ?? null,
      m.phone ?? null,
      m.address ?? null,
      m.blood_group ?? null,
      m.allergies ?? null,
      m.emergency_contact ?? null,
      m.notes ?? null,
      existing.id,
    );
    return db.prepare('SELECT * FROM patients WHERE id = ?').get(existing.id);
  });

  // Suppression réservée à l'ADMIN, et refusée si le dossier est déjà rattaché à des données.
  app.delete(
    '/patients/:id',
    { preHandler: [app.authenticate, app.requireRole('ADMIN')] },
    async (req) => {
      const { id } = req.params as { id: string };
      const db = getDb();
      const pid = Number(id);
      const refs = db
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM consultations WHERE patient_id = ?) AS c,
            (SELECT COUNT(*) FROM appointments  WHERE patient_id = ?) AS a,
            (SELECT COUNT(*) FROM invoices      WHERE patient_id = ?) AS i`,
        )
        .get(pid, pid, pid) as { c: number; a: number; i: number };
      if (refs.c > 0 || refs.a > 0 || refs.i > 0) {
        throw conflict(
          'Impossible de supprimer un patient rattaché à des consultations, rendez-vous ou factures.',
        );
      }
      const info = db.prepare('DELETE FROM patients WHERE id = ?').run(pid);
      if (info.changes === 0) throw notFound('Patient introuvable');
      return { deleted: true };
    },
  );
}
