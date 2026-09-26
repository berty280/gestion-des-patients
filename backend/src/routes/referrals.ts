import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { ReferralRow, SpecialistScheduleRow, UserRow } from '../types.js';

const specialtyEnum = z.enum(['KINE', 'OPHTALMOLOGIE', 'DERMATOLOGIE', 'GYNECOLOGIE', 'RADIOLOGIE']);

const createSchema = z.object({
  patient_id: z.number().int().positive(),
  consultation_id: z.number().int().positive().nullish(),
  to_specialty: specialtyEnum,
  to_user_id: z.number().int().positive().nullish(),
  indications: z.string().trim().max(2000).nullish(),
  // Rendez-vous optionnel (créé en même temps que la référence).
  scheduled_at: z.string().min(1).nullish(),
  reason: z.string().trim().max(500).nullish(),
});

const updateSchema = z.object({
  to_user_id: z.number().int().positive().nullish(),
  status: z.enum(['EN_ATTENTE', 'PLANIFIE', 'TERMINE', 'ANNULE']).optional(),
  indications: z.string().trim().max(2000).nullish(),
});

const withNames = `
  SELECT r.*, p.first_name, p.last_name, p.code AS patient_code,
         fu.name AS from_user_name, tu.name AS to_user_name,
         a.scheduled_at AS appointment_at
  FROM referrals r
  JOIN patients p ON p.id = r.patient_id
  LEFT JOIN users fu ON fu.id = r.from_user_id
  LEFT JOIN users tu ON tu.id = r.to_user_id
  LEFT JOIN appointments a ON a.id = r.appointment_id
`;

/** Vérifie que le spécialiste travaille ce jour de la semaine. */
function specialistWorksOn(db: ReturnType<typeof getDb>, userId: number, iso: string): boolean {
  const weekday = new Date(iso).getDay();
  const rows = db
    .prepare('SELECT * FROM specialist_schedules WHERE user_id = ?')
    .all(userId) as SpecialistScheduleRow[];
  if (rows.length === 0) return true; // pas de calendrier défini → pas de contrainte
  return rows.some((s) => s.weekday === weekday);
}

export async function referralRoutes(app: FastifyInstance): Promise<void> {
  app.get('/referrals', { preHandler: [app.authenticate, app.requireMedecin] }, async (req) => {
    const { patient_id, status, mine } = req.query as {
      patient_id?: string;
      status?: string;
      mine?: string;
    };
    const db = getDb();
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (patient_id) {
      clauses.push('r.patient_id = ?');
      args.push(Number(patient_id));
    }
    if (status) {
      clauses.push('r.status = ?');
      args.push(status);
    }
    // Boîte de réception du spécialiste : références qui lui sont assignées
    // ou adressées à sa spécialité sans destinataire précis.
    if (mine === '1' && req.user.role === 'SPECIALISTE') {
      clauses.push('(r.to_user_id = ? OR (r.to_user_id IS NULL AND r.to_specialty = ?))');
      args.push(req.user.id, req.user.specialty);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(`${withNames} ${where} ORDER BY r.created_at DESC LIMIT 200`).all(...args);
  });

  app.post('/referrals', { preHandler: [app.authenticate, app.requireMedecin] }, async (req, reply) => {
    const body = parse(createSchema, req.body);
    const db = getDb();

    if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patient_id)) {
      throw notFound('Patient introuvable');
    }
    if (body.to_user_id) {
      const spec = db.prepare('SELECT * FROM users WHERE id = ?').get(body.to_user_id) as
        | UserRow
        | undefined;
      if (!spec || spec.role !== 'SPECIALISTE') throw badRequest('Spécialiste invalide.');
      if (spec.specialty !== body.to_specialty) {
        throw badRequest('Le spécialiste choisi ne correspond pas à la spécialité.');
      }
      if (body.scheduled_at && !specialistWorksOn(db, body.to_user_id, body.scheduled_at)) {
        throw badRequest('Le spécialiste ne consulte pas ce jour-là (voir son calendrier).');
      }
    }

    const create = db.transaction(() => {
      const hasAppt = !!body.scheduled_at;
      const status = hasAppt ? 'PLANIFIE' : 'EN_ATTENTE';
      const info = db
        .prepare(
          `INSERT INTO referrals (patient_id, from_user_id, consultation_id, to_specialty, to_user_id, indications, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          body.patient_id,
          req.user.id,
          body.consultation_id ?? null,
          body.to_specialty,
          body.to_user_id ?? null,
          body.indications ?? null,
          status,
        );
      const referralId = Number(info.lastInsertRowid);

      if (hasAppt) {
        const appt = db
          .prepare(
            `INSERT INTO appointments (patient_id, scheduled_at, reason, status, user_id, assigned_user_id, specialty, referral_id)
             VALUES (?, ?, ?, 'PLANIFIE', ?, ?, ?, ?)`,
          )
          .run(
            body.patient_id,
            body.scheduled_at,
            body.reason ?? `Consultation ${body.to_specialty} (référée)`,
            req.user.id,
            body.to_user_id ?? null,
            body.to_specialty,
            referralId,
          );
        db.prepare('UPDATE referrals SET appointment_id = ? WHERE id = ?').run(
          Number(appt.lastInsertRowid),
          referralId,
        );
      }
      return referralId;
    });

    const referralId = create();
    reply.code(201);
    return db.prepare(`${withNames} WHERE r.id = ?`).get(referralId);
  });

  app.patch('/referrals/:id', { preHandler: [app.authenticate, app.requireMedecin] }, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(updateSchema, req.body);
    const db = getDb();
    const existing = db.prepare('SELECT * FROM referrals WHERE id = ?').get(Number(id)) as
      | ReferralRow
      | undefined;
    if (!existing) throw notFound('Référence introuvable');

    // Un spécialiste ne peut agir que sur ce qui le concerne.
    if (
      req.user.role === 'SPECIALISTE' &&
      existing.to_user_id !== req.user.id &&
      !(existing.to_user_id === null && existing.to_specialty === req.user.specialty)
    ) {
      throw forbidden('Référence non assignée à vous.');
    }

    const to_user_id = body.to_user_id !== undefined ? body.to_user_id : existing.to_user_id;
    const status = body.status ?? existing.status;
    const indications = body.indications !== undefined ? body.indications : existing.indications;

    db.prepare('UPDATE referrals SET to_user_id = ?, status = ?, indications = ? WHERE id = ?').run(
      to_user_id ?? null,
      status,
      indications ?? null,
      existing.id,
    );
    return db.prepare(`${withNames} WHERE r.id = ?`).get(existing.id);
  });
}
