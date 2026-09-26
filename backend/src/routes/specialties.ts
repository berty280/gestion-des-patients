import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { SPECIALTIES, specialtyLabel } from '../lib/roles.js';
import type { SpecialistScheduleRow } from '../types.js';

export async function specialtyRoutes(app: FastifyInstance): Promise<void> {
  // Liste statique des spécialités gérées par le centre.
  app.get('/specialties', { preHandler: [app.authenticate] }, async () => {
    return SPECIALTIES.map((code) => ({ code, label: specialtyLabel[code] }));
  });

  // Spécialistes actifs (avec leurs jours de prestation), filtrable par spécialité.
  app.get('/specialists', { preHandler: [app.authenticate] }, async (req) => {
    const { specialty } = req.query as { specialty?: string };
    const db = getDb();
    const rows = (
      specialty
        ? db
            .prepare(
              "SELECT id, name, specialty FROM users WHERE role='SPECIALISTE' AND active=1 AND specialty=? ORDER BY name",
            )
            .all(specialty)
        : db
            .prepare(
              "SELECT id, name, specialty FROM users WHERE role='SPECIALISTE' AND active=1 ORDER BY specialty, name",
            )
            .all()
    ) as Array<{ id: number; name: string; specialty: string }>;

    return rows.map((u) => {
      const schedules = db
        .prepare('SELECT * FROM specialist_schedules WHERE user_id = ? ORDER BY weekday, start_time')
        .all(u.id) as SpecialistScheduleRow[];
      return { ...u, weekdays: [...new Set(schedules.map((s) => s.weekday))], schedules };
    });
  });
}
