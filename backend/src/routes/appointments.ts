import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { badRequest, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { AppointmentRow, SpecialistScheduleRow } from '../types.js';

const statusEnum = z.enum(['PLANIFIE', 'EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ANNULE']);
const specialtyEnum = z.enum(['KINE', 'OPHTALMOLOGIE', 'DERMATOLOGIE', 'GYNECOLOGIE', 'RADIOLOGIE']);

const createBody = z.object({
  patient_id: z.number().int().positive(),
  scheduled_at: z.string().min(1),
  reason: z.string().trim().max(500).nullish(),
  status: statusEnum.optional(),
  assigned_user_id: z.number().int().positive().nullish(),
  specialty: specialtyEnum.nullish(),
});

const updateBody = z.object({
  scheduled_at: z.string().min(1).optional(),
  reason: z.string().trim().max(500).nullish(),
  status: statusEnum.optional(),
  assigned_user_id: z.number().int().positive().nullish(),
});

const withPatient = `
  SELECT a.*, p.first_name, p.last_name, p.code AS patient_code, p.phone AS patient_phone,
         u.name AS user_name, au.name AS assigned_name
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN users u ON u.id = a.user_id
  LEFT JOIN users au ON au.id = a.assigned_user_id
`;

function worksOn(db: ReturnType<typeof getDb>, userId: number, iso: string): boolean {
  const weekday = new Date(iso).getDay();
  const rows = db
    .prepare('SELECT * FROM specialist_schedules WHERE user_id = ?')
    .all(userId) as SpecialistScheduleRow[];
  if (rows.length === 0) return true;
  return rows.some((s) => s.weekday === weekday);
}

export async function appointmentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/appointments', { preHandler: [app.authenticate] }, async (req) => {
    const { date, status, assigned_user_id, specialty, scope } = req.query as {
      date?: string;
      status?: string;
      assigned_user_id?: string;
      specialty?: string;
      scope?: string;
    };
    const db = getDb();
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      clauses.push('substr(a.scheduled_at, 1, 10) = ?');
      args.push(date);
    }
    if (status) {
      clauses.push('a.status = ?');
      args.push(status);
    }
    if (assigned_user_id) {
      clauses.push('a.assigned_user_id = ?');
      args.push(Number(assigned_user_id));
    }
    if (specialty) {
      clauses.push('a.specialty = ?');
      args.push(specialty);
    }
    // scope=mine : rendez-vous assignés au spécialiste connecté.
    if (scope === 'mine' && req.user.role === 'SPECIALISTE') {
      clauses.push('a.assigned_user_id = ?');
      args.push(req.user.id);
    }
    // scope=general : file d'attente généraliste (sans spécialité).
    if (scope === 'general') {
      clauses.push('a.specialty IS NULL');
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(`${withPatient} ${where} ORDER BY a.scheduled_at`).all(...args);
  });

  app.post('/appointments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = parse(createBody, req.body);
    const db = getDb();
    if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patient_id)) {
      throw notFound('Patient introuvable');
    }
    if (body.assigned_user_id && !worksOn(db, body.assigned_user_id, body.scheduled_at)) {
      throw badRequest('Le praticien ne consulte pas ce jour-là (voir son calendrier).');
    }
    const info = db
      .prepare(
        `INSERT INTO appointments (patient_id, scheduled_at, reason, status, user_id, assigned_user_id, specialty)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        body.patient_id,
        body.scheduled_at,
        body.reason ?? null,
        body.status ?? 'PLANIFIE',
        req.user.id,
        body.assigned_user_id ?? null,
        body.specialty ?? null,
      );
    reply.code(201);
    return db.prepare(`${withPatient} WHERE a.id = ?`).get(info.lastInsertRowid);
  });

  app.patch('/appointments/:id', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(updateBody, req.body);
    const db = getDb();
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(id)) as
      | AppointmentRow
      | undefined;
    if (!existing) throw notFound('Rendez-vous introuvable');
    const m = { ...existing, ...body };
    if (m.assigned_user_id && worksOn(db, m.assigned_user_id, m.scheduled_at) === false) {
      throw badRequest('Le praticien ne consulte pas ce jour-là (voir son calendrier).');
    }
    db.prepare(
      'UPDATE appointments SET scheduled_at = ?, reason = ?, status = ?, assigned_user_id = ? WHERE id = ?',
    ).run(m.scheduled_at, m.reason ?? null, m.status, m.assigned_user_id ?? null, existing.id);
    return db.prepare(`${withPatient} WHERE a.id = ?`).get(existing.id);
  });

  app.delete('/appointments/:id', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const info = getDb().prepare('DELETE FROM appointments WHERE id = ?').run(Number(id));
    if (info.changes === 0) throw notFound('Rendez-vous introuvable');
    return { deleted: true };
  });
}
