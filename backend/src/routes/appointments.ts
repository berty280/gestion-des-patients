import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { AppointmentRow } from '../types.js';

const statusEnum = z.enum(['PLANIFIE', 'EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ANNULE']);

const createBody = z.object({
  patient_id: z.number().int().positive(),
  scheduled_at: z.string().min(1), // ISO datetime
  reason: z.string().trim().max(500).nullish(),
  status: statusEnum.optional(),
});

const updateBody = z.object({
  scheduled_at: z.string().min(1).optional(),
  reason: z.string().trim().max(500).nullish(),
  status: statusEnum.optional(),
});

const withPatient = `
  SELECT a.*, p.first_name, p.last_name, p.code AS patient_code, p.phone AS patient_phone,
         u.name AS user_name
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN users u ON u.id = a.user_id
`;

export async function appointmentRoutes(app: FastifyInstance): Promise<void> {
  // Rendez-vous & file d'attente — tous les rôles (accueil inclus).
  app.get('/appointments', { preHandler: [app.authenticate] }, async (req) => {
    const { date, status } = req.query as { date?: string; status?: string };
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
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(`${withPatient} ${where} ORDER BY a.scheduled_at`).all(...args);
  });

  app.post('/appointments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = parse(createBody, req.body);
    const db = getDb();
    if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patient_id)) {
      throw notFound('Patient introuvable');
    }
    const info = db
      .prepare(
        `INSERT INTO appointments (patient_id, scheduled_at, reason, status, user_id)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        body.patient_id,
        body.scheduled_at,
        body.reason ?? null,
        body.status ?? 'PLANIFIE',
        req.user.id,
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
    db.prepare('UPDATE appointments SET scheduled_at = ?, reason = ?, status = ? WHERE id = ?').run(
      m.scheduled_at,
      m.reason ?? null,
      m.status,
      existing.id,
    );
    return db.prepare(`${withPatient} WHERE a.id = ?`).get(existing.id);
  });

  app.delete('/appointments/:id', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const info = getDb().prepare('DELETE FROM appointments WHERE id = ?').run(Number(id));
    if (info.changes === 0) throw notFound('Rendez-vous introuvable');
    return { deleted: true };
  });
}
