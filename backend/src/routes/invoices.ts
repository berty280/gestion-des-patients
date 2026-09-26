import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { badRequest, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { InvoiceStatus } from '../types.js';

const itemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(9999),
  unit_price: z.number().int().min(0).max(100_000_000),
});

const createBody = z.object({
  patient_id: z.number().int().positive(),
  consultation_id: z.number().int().positive().nullish(),
  note: z.string().trim().max(500).nullish(),
  items: z.array(itemSchema).min(1, 'Au moins une ligne est requise'),
});

const paymentBody = z.object({
  amount: z.number().int().positive().max(100_000_000),
  method: z.enum(['ESPECES', 'MOBILE_MONEY', 'CARTE', 'AUTRE']).optional(),
});

function statusOf(total: number, paid: number): InvoiceStatus {
  if (paid <= 0) return 'IMPAYEE';
  if (paid >= total) return 'PAYEE';
  return 'PARTIELLE';
}

function invoiceCode(id: number): string {
  return `F-${String(id).padStart(5, '0')}`;
}

const listSql = `
  SELECT i.*, p.first_name, p.last_name, p.code AS patient_code,
    COALESCE((SELECT SUM(quantity * unit_price) FROM invoice_items WHERE invoice_id = i.id), 0) AS total,
    COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) AS paid
  FROM invoices i
  JOIN patients p ON p.id = i.patient_id
`;

interface ListRow {
  total: number;
  paid: number;
  [k: string]: unknown;
}

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  // Facturation & paiements — tous les rôles (accueil inclus).
  app.get('/invoices', { preHandler: [app.authenticate] }, async (req) => {
    const { status, patient_id } = req.query as { status?: string; patient_id?: string };
    const db = getDb();
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (patient_id) {
      clauses.push('i.patient_id = ?');
      args.push(Number(patient_id));
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`${listSql} ${where} ORDER BY i.created_at DESC LIMIT 300`)
      .all(...args) as ListRow[];
    const withStatus = rows.map((r) => ({ ...r, status: statusOf(r.total, r.paid) }));
    return status ? withStatus.filter((r) => r.status === status) : withStatus;
  });

  app.get('/invoices/:id', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const invoice = db.prepare(`${listSql} WHERE i.id = ?`).get(Number(id)) as ListRow | undefined;
    if (!invoice) throw notFound('Facture introuvable');
    const items = db
      .prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id')
      .all(Number(id));
    const payments = db
      .prepare(
        `SELECT pay.*, u.name AS user_name FROM payments pay
         LEFT JOIN users u ON u.id = pay.user_id
         WHERE pay.invoice_id = ? ORDER BY pay.created_at`,
      )
      .all(Number(id));
    return { ...invoice, status: statusOf(invoice.total, invoice.paid), items, payments };
  });

  app.post('/invoices', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = parse(createBody, req.body);
    const db = getDb();
    if (!db.prepare('SELECT id FROM patients WHERE id = ?').get(body.patient_id)) {
      throw notFound('Patient introuvable');
    }

    const create = db.transaction(() => {
      const info = db
        .prepare(
          'INSERT INTO invoices (patient_id, consultation_id, user_id, note) VALUES (?, ?, ?, ?)',
        )
        .run(body.patient_id, body.consultation_id ?? null, req.user.id, body.note ?? null);
      const newId = Number(info.lastInsertRowid);
      db.prepare('UPDATE invoices SET code = ? WHERE id = ?').run(invoiceCode(newId), newId);
      const insertItem = db.prepare(
        'INSERT INTO invoice_items (invoice_id, label, quantity, unit_price) VALUES (?, ?, ?, ?)',
      );
      for (const it of body.items) {
        insertItem.run(newId, it.label, it.quantity, it.unit_price);
      }
      return newId;
    });
    const newId = create();
    reply.code(201);
    const invoice = db.prepare(`${listSql} WHERE i.id = ?`).get(newId) as ListRow;
    return { ...invoice, status: statusOf(invoice.total, invoice.paid) };
  });

  app.post('/invoices/:id/payments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(paymentBody, req.body);
    const db = getDb();
    const invoice = db.prepare(`${listSql} WHERE i.id = ?`).get(Number(id)) as ListRow | undefined;
    if (!invoice) throw notFound('Facture introuvable');

    const remaining = invoice.total - invoice.paid;
    if (remaining <= 0) throw badRequest('Cette facture est déjà réglée.');
    if (body.amount > remaining) {
      throw badRequest(`Le montant dépasse le reste à payer (${remaining} FCFA).`);
    }

    db.prepare('INSERT INTO payments (invoice_id, amount, method, user_id) VALUES (?, ?, ?, ?)').run(
      Number(id),
      body.amount,
      body.method ?? 'ESPECES',
      req.user.id,
    );
    reply.code(201);
    const updated = db.prepare(`${listSql} WHERE i.id = ?`).get(Number(id)) as ListRow;
    return { ...updated, status: statusOf(updated.total, updated.paid) };
  });

  app.delete(
    '/invoices/:id',
    { preHandler: [app.authenticate, app.requireRole('ADMIN')] },
    async (req) => {
      const { id } = req.params as { id: string };
      // invoice_items & payments partent en cascade (ON DELETE CASCADE).
      const info = getDb().prepare('DELETE FROM invoices WHERE id = ?').run(Number(id));
      if (info.changes === 0) throw notFound('Facture introuvable');
      return { deleted: true };
    },
  );
}
