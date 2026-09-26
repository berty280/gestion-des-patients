import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';

const num = z.number().finite();

const prescriptionSchema = z.object({
  medication: z.string().trim().min(1).max(200),
  dosage: z.string().trim().max(120).nullish(),
  frequency: z.string().trim().max(120).nullish(),
  duration: z.string().trim().max(120).nullish(),
  instructions: z.string().trim().max(500).nullish(),
});

const examSchema = z.object({
  category: z.enum(['LABORATOIRE', 'IMAGERIE']),
  label: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(500).nullish(),
});

const consultationBody = z.object({
  patient_id: z.number().int().positive(),
  type: z.enum(['GENERALE', 'SPECIALISTE']).default('GENERALE'),
  specialty: z.enum(['KINE', 'OPHTALMOLOGIE', 'DERMATOLOGIE', 'GYNECOLOGIE', 'RADIOLOGIE']).nullish(),
  referral_id: z.number().int().positive().nullish(),
  motif: z.string().trim().max(500).nullish(),
  symptoms: z.string().trim().max(2000).nullish(),
  weight_kg: num.min(0).max(500).nullish(),
  height_cm: num.min(0).max(300).nullish(),
  temperature_c: num.min(25).max(45).nullish(),
  bp_systolic: z.number().int().min(0).max(300).nullish(),
  bp_diastolic: z.number().int().min(0).max(200).nullish(),
  pulse: z.number().int().min(0).max(300).nullish(),
  findings: z.string().trim().max(4000).nullish(),
  procedures: z.string().trim().max(4000).nullish(),
  diagnosis: z.string().trim().max(2000).nullish(),
  summary: z.string().trim().max(4000).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  pathology_ids: z.array(z.number().int().positive()).max(50).optional(),
  prescriptions: z.array(prescriptionSchema).max(50).optional(),
  exams: z.array(examSchema).max(50).optional(),
});

const withPatient = `
  SELECT c.*, p.first_name, p.last_name, p.code AS patient_code, u.name AS user_name
  FROM consultations c
  JOIN patients p ON p.id = c.patient_id
  LEFT JOIN users u ON u.id = c.user_id
`;

function loadFull(db: ReturnType<typeof getDb>, id: number) {
  const consultation = db.prepare(`${withPatient} WHERE c.id = ?`).get(id);
  if (!consultation) return null;
  const pathologies = db
    .prepare(
      `SELECT pa.* FROM consultation_pathologies cp
       JOIN pathologies pa ON pa.id = cp.pathology_id
       WHERE cp.consultation_id = ? ORDER BY pa.code`,
    )
    .all(id);
  const prescriptions = db
    .prepare('SELECT * FROM prescriptions WHERE consultation_id = ? ORDER BY id')
    .all(id);
  const exams = db.prepare('SELECT * FROM exam_orders WHERE consultation_id = ? ORDER BY id').all(id);
  return { ...consultation, pathologies, prescriptions, exams };
}

export async function consultationRoutes(app: FastifyInstance): Promise<void> {
  // Confidentialité médicale : réservé au personnel médical.
  const guard = { preHandler: [app.authenticate, app.requireMedecin] };

  app.get('/consultations', guard, async (req) => {
    const { patient_id, type, specialty, mine } = req.query as {
      patient_id?: string;
      type?: string;
      specialty?: string;
      mine?: string;
    };
    const db = getDb();
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (patient_id) {
      clauses.push('c.patient_id = ?');
      args.push(Number(patient_id));
    }
    if (type) {
      clauses.push('c.type = ?');
      args.push(type);
    }
    if (specialty) {
      clauses.push('c.specialty = ?');
      args.push(specialty);
    }
    if (mine === '1') {
      clauses.push('c.user_id = ?');
      args.push(req.user.id);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(`${withPatient} ${where} ORDER BY c.created_at DESC LIMIT 200`).all(...args);
  });

  app.get('/consultations/:id', guard, async (req) => {
    const { id } = req.params as { id: string };
    const full = loadFull(getDb(), Number(id));
    if (!full) throw notFound('Consultation introuvable');
    return full;
  });

  app.post('/consultations', guard, async (req, reply) => {
    const body = parse(consultationBody, req.body);
    const db = getDb();
    const user = req.user;

    // Autorisation selon le type de consultation.
    if (body.type === 'GENERALE' && !(user.role === 'GENERALISTE' || user.role === 'ADMIN')) {
      throw forbidden('Seul un généraliste peut enregistrer une consultation générale.');
    }
    let specialty: string | null = null;
    if (body.type === 'SPECIALISTE') {
      if (user.role === 'SPECIALISTE') specialty = user.specialty;
      else if (user.role === 'ADMIN') specialty = body.specialty ?? null;
      else throw forbidden('Seul un spécialiste peut enregistrer une consultation spécialisée.');
      if (!specialty) throw badRequest('Spécialité requise pour une consultation spécialisée.');
    }

    if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patient_id)) {
      throw notFound('Patient introuvable');
    }

    const create = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO consultations
            (patient_id, user_id, type, specialty, referral_id, motif, symptoms,
             weight_kg, height_cm, temperature_c, bp_systolic, bp_diastolic, pulse,
             findings, procedures, diagnosis, summary, notes)
           VALUES
            (@patient_id, @user_id, @type, @specialty, @referral_id, @motif, @symptoms,
             @weight_kg, @height_cm, @temperature_c, @bp_systolic, @bp_diastolic, @pulse,
             @findings, @procedures, @diagnosis, @summary, @notes)`,
        )
        .run({
          patient_id: body.patient_id,
          user_id: user.id,
          type: body.type,
          specialty,
          referral_id: body.referral_id ?? null,
          motif: body.motif ?? null,
          symptoms: body.symptoms ?? null,
          weight_kg: body.weight_kg ?? null,
          height_cm: body.height_cm ?? null,
          temperature_c: body.temperature_c ?? null,
          bp_systolic: body.bp_systolic ?? null,
          bp_diastolic: body.bp_diastolic ?? null,
          pulse: body.pulse ?? null,
          findings: body.findings ?? null,
          procedures: body.procedures ?? null,
          diagnosis: body.diagnosis ?? null,
          summary: body.summary ?? null,
          notes: body.notes ?? null,
        });
      const consultId = Number(info.lastInsertRowid);

      if (body.pathology_ids?.length) {
        const link = db.prepare(
          'INSERT OR IGNORE INTO consultation_pathologies (consultation_id, pathology_id) VALUES (?, ?)',
        );
        for (const pid of body.pathology_ids) link.run(consultId, pid);
      }
      if (body.prescriptions?.length) {
        const ins = db.prepare(
          `INSERT INTO prescriptions (consultation_id, patient_id, medication, dosage, frequency, duration, instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const p of body.prescriptions) {
          ins.run(
            consultId,
            body.patient_id,
            p.medication,
            p.dosage ?? null,
            p.frequency ?? null,
            p.duration ?? null,
            p.instructions ?? null,
          );
        }
      }
      if (body.exams?.length) {
        const ins = db.prepare(
          'INSERT INTO exam_orders (consultation_id, patient_id, category, label, notes) VALUES (?, ?, ?, ?, ?)',
        );
        for (const e of body.exams) {
          ins.run(consultId, body.patient_id, e.category, e.label, e.notes ?? null);
        }
      }

      // Si la consultation clôt une référence, on marque la référence (et son RDV) terminés.
      if (body.referral_id) {
        db.prepare("UPDATE referrals SET status='TERMINE' WHERE id = ?").run(body.referral_id);
        db.prepare(
          "UPDATE appointments SET status='TERMINE' WHERE referral_id = ? AND status NOT IN ('ANNULE')",
        ).run(body.referral_id);
      }

      return consultId;
    });

    const consultId = create();
    reply.code(201);
    return loadFull(db, consultId);
  });
}
