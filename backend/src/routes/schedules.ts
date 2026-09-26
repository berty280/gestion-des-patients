import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { SpecialistScheduleRow, UserRow } from '../types.js';

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const bodySchema = z.object({
  user_id: z.number().int().positive(),
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(timeRe, 'Heure attendue HH:MM').optional(),
  end_time: z.string().regex(timeRe, 'Heure attendue HH:MM').optional(),
});

export async function scheduleRoutes(app: FastifyInstance): Promise<void> {
  // Lecture : tout utilisateur authentifié (pour la prise de rendez-vous).
  app.get('/schedules', { preHandler: [app.authenticate] }, async (req) => {
    const { user_id } = req.query as { user_id?: string };
    const db = getDb();
    if (user_id) {
      return db
        .prepare('SELECT * FROM specialist_schedules WHERE user_id = ? ORDER BY weekday, start_time')
        .all(Number(user_id));
    }
    return db.prepare('SELECT * FROM specialist_schedules ORDER BY user_id, weekday').all();
  });

  // Création : admin, ou le spécialiste pour son propre calendrier.
  app.post('/schedules', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = parse(bodySchema, req.body);
    if (req.user.role !== 'ADMIN' && req.user.id !== body.user_id) {
      throw forbidden('Vous ne pouvez modifier que votre propre calendrier.');
    }
    const db = getDb();
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(body.user_id) as
      | UserRow
      | undefined;
    if (!target) throw notFound('Utilisateur introuvable');
    if (target.role !== 'SPECIALISTE') {
      throw badRequest('Seuls les spécialistes ont un calendrier de prestation.');
    }
    const start_time = body.start_time ?? '08:00';
    const end_time = body.end_time ?? '16:00';
    if (end_time <= start_time) {
      throw badRequest("L'heure de fin doit être après l'heure de début.");
    }
    const info = db
      .prepare(
        'INSERT INTO specialist_schedules (user_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)',
      )
      .run(body.user_id, body.weekday, start_time, end_time);
    reply.code(201);
    return db.prepare('SELECT * FROM specialist_schedules WHERE id = ?').get(info.lastInsertRowid);
  });

  app.delete('/schedules/:id', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const row = db.prepare('SELECT * FROM specialist_schedules WHERE id = ?').get(Number(id)) as
      | SpecialistScheduleRow
      | undefined;
    if (!row) throw notFound('Créneau introuvable');
    if (req.user.role !== 'ADMIN' && req.user.id !== row.user_id) {
      throw forbidden('Vous ne pouvez modifier que votre propre calendrier.');
    }
    db.prepare('DELETE FROM specialist_schedules WHERE id = ?').run(row.id);
    return { deleted: true };
  });
}
