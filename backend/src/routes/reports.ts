import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';

/** Local calendar day in YYYY-MM-DD (server timezone). */
function today(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // Indicateurs du tableau de bord — tous les rôles.
  app.get('/reports/dashboard', { preHandler: [app.authenticate] }, async (req) => {
    const db = getDb();
    const day = today();
    const one = (sql: string, ...args: unknown[]) =>
      (db.prepare(sql).get(...args) as { n: number }).n;

    const patients_total = one('SELECT COUNT(*) AS n FROM patients');
    const consultations_today = one(
      "SELECT COUNT(*) AS n FROM consultations WHERE substr(created_at,1,10) = ?",
      day,
    );
    const appointments_today = one(
      'SELECT COUNT(*) AS n FROM appointments WHERE substr(scheduled_at,1,10) = ?',
      day,
    );
    const queue_waiting = one(
      "SELECT COUNT(*) AS n FROM appointments WHERE substr(scheduled_at,1,10) = ? AND status IN ('EN_ATTENTE','EN_COURS')",
      day,
    );
    const invoices_unpaid = one(`
      SELECT COUNT(*) AS n FROM invoices i
      WHERE COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0)
          < COALESCE((SELECT SUM(quantity * unit_price) FROM invoice_items WHERE invoice_id = i.id), 0)
    `);
    const revenue_today = (
      db
        .prepare("SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE substr(created_at,1,10) = ?")
        .get(day) as { n: number }
    ).n;

    // Indicateurs spécifiques au spécialiste connecté.
    let my_referrals_pending = 0;
    let my_appointments_today = 0;
    if (req.user.role === 'SPECIALISTE') {
      my_referrals_pending = one(
        `SELECT COUNT(*) AS n FROM referrals
         WHERE status IN ('EN_ATTENTE','PLANIFIE')
           AND (to_user_id = ? OR (to_user_id IS NULL AND to_specialty = ?))`,
        req.user.id,
        req.user.specialty,
      );
      my_appointments_today = one(
        'SELECT COUNT(*) AS n FROM appointments WHERE assigned_user_id = ? AND substr(scheduled_at,1,10) = ?',
        req.user.id,
        day,
      );
    }

    return {
      patients_total,
      consultations_today,
      appointments_today,
      queue_waiting,
      invoices_unpaid,
      revenue_today,
      my_referrals_pending,
      my_appointments_today,
    };
  });

  // Rapport d'activité détaillé — réservé à l'ADMIN.
  app.get(
    '/reports/activity',
    { preHandler: [app.authenticate, app.requireRole('ADMIN')] },
    async (req) => {
      const { date } = req.query as { date?: string };
      const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today();
      const db = getDb();

      const new_patients = (
        db
          .prepare("SELECT COUNT(*) AS n FROM patients WHERE substr(created_at,1,10) = ?")
          .get(day) as { n: number }
      ).n;

      const consultations = db
        .prepare(
          `SELECT c.id, c.created_at, c.motif, c.diagnosis,
                  p.first_name, p.last_name, p.code AS patient_code, u.name AS user_name
           FROM consultations c
           JOIN patients p ON p.id = c.patient_id
           LEFT JOIN users u ON u.id = c.user_id
           WHERE substr(c.created_at,1,10) = ?
           ORDER BY c.created_at`,
        )
        .all(day);

      const payments = db
        .prepare(
          `SELECT pay.id, pay.amount, pay.method, pay.created_at,
                  i.code AS invoice_code, p.first_name, p.last_name
           FROM payments pay
           JOIN invoices i ON i.id = pay.invoice_id
           JOIN patients p ON p.id = i.patient_id
           WHERE substr(pay.created_at,1,10) = ?
           ORDER BY pay.created_at`,
        )
        .all(day);

      const revenue = (
        db
          .prepare("SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE substr(created_at,1,10) = ?")
          .get(day) as { n: number }
      ).n;

      return {
        date: day,
        new_patients,
        consultations_count: consultations.length,
        revenue,
        consultations,
        payments,
      };
    },
  );
}
