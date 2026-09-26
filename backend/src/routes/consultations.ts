import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { ConsultationRow } from '../types.js';

const num = z.number().finite();

const consultationBody = z.object({
  patient_id: z.number().int().positive(),
  motif: z.string().trim().max(500).nullish(),
  symptoms: z.string().trim().max(2000).nullish(),
  diagnosis: z.string().trim().max(2000).nullish(),
  treatment: z.string().trim().max(2000).nullish(),
  weight_kg: num.min(0).max(500).nullish(),
  height_cm: num.min(0).max(300).nullish(),
  temperature_c: num.min(25).max(45).nullish(),
  bp_systolic: z.number().int().min(0).max(300).nullish(),
  bp_diastolic: z.number().int().min(0).max(200).nullish(),
  pulse: z.number().int().min(0).max(300).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

const withPatient = `
  SELECT c.*, p.first_name, p.last_name, p.code AS patient_code, u.name AS user_name
  FROM consultations c
  JOIN patients p ON p.id = c.patient_id
  LEFT JOIN users u ON u.id = c.user_id
`;

export async function consultationRoutes(app: FastifyInstance): Promise<void> {
  // Confidentialité médicale : consultations accessibles aux SOIGNANT et plus.
  const guard = { preHandler: [app.authenticate, app.requireRole('SOIGNANT')] };

  app.get('/consultations', guard, async (req) => {
    const { patient_id } = req.query as { patient_id?: string };
    const db = getDb();
    if (patient_id) {
      return db
        .prepare(`${withPatient} WHERE c.patient_id = ? ORDER BY c.created_at DESC`)
        .all(Number(patient_id));
    }
    return db.prepare(`${withPatient} ORDER BY c.created_at DESC LIMIT 100`).all();
  });

  app.get('/consultations/:id', guard, async (req) => {
    const { id } = req.params as { id: string };
    const row = getDb().prepare(`${withPatient} WHERE c.id = ?`).get(Number(id));
    if (!row) throw notFound('Consultation introuvable');
    return row;
  });

  app.post('/consultations', guard, async (req, reply) => {
    const body = parse(consultationBody, req.body);
    const db = getDb();
    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patient_id);
    if (!patient) throw notFound('Patient introuvable');

    const info = db
      .prepare(
        `INSERT INTO consultations
          (patient_id, user_id, motif, symptoms, diagnosis, treatment,
           weight_kg, height_cm, temperature_c, bp_systolic, bp_diastolic, pulse, notes)
         VALUES
          (@patient_id, @user_id, @motif, @symptoms, @diagnosis, @treatment,
           @weight_kg, @height_cm, @temperature_c, @bp_systolic, @bp_diastolic, @pulse, @notes)`,
      )
      .run({
        patient_id: body.patient_id,
        user_id: req.user.id,
        motif: body.motif ?? null,
        symptoms: body.symptoms ?? null,
        diagnosis: body.diagnosis ?? null,
        treatment: body.treatment ?? null,
        weight_kg: body.weight_kg ?? null,
        height_cm: body.height_cm ?? null,
        temperature_c: body.temperature_c ?? null,
        bp_systolic: body.bp_systolic ?? null,
        bp_diastolic: body.bp_diastolic ?? null,
        pulse: body.pulse ?? null,
        notes: body.notes ?? null,
      });
    reply.code(201);
    return db.prepare(`${withPatient} WHERE c.id = ?`).get(info.lastInsertRowid);
  });

  app.patch('/consultations/:id', guard, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(consultationBody.partial().omit({ patient_id: true }), req.body);
    const db = getDb();
    const existing = db.prepare('SELECT * FROM consultations WHERE id = ?').get(Number(id)) as
      | ConsultationRow
      | undefined;
    if (!existing) throw notFound('Consultation introuvable');
    const m = { ...existing, ...body };
    db.prepare(
      `UPDATE consultations SET
        motif = ?, symptoms = ?, diagnosis = ?, treatment = ?,
        weight_kg = ?, height_cm = ?, temperature_c = ?,
        bp_systolic = ?, bp_diastolic = ?, pulse = ?, notes = ?
       WHERE id = ?`,
    ).run(
      m.motif ?? null,
      m.symptoms ?? null,
      m.diagnosis ?? null,
      m.treatment ?? null,
      m.weight_kg ?? null,
      m.height_cm ?? null,
      m.temperature_c ?? null,
      m.bp_systolic ?? null,
      m.bp_diastolic ?? null,
      m.pulse ?? null,
      m.notes ?? null,
      existing.id,
    );
    return db.prepare(`${withPatient} WHERE c.id = ?`).get(existing.id);
  });
}
