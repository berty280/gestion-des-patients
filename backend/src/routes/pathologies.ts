import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';

const bodySchema = z.object({
  specialty: z.string().trim().min(1).max(40), // Specialty | 'GENERAL'
  code: z.string().trim().max(20).nullish(),
  label: z.string().trim().min(1).max(300),
});

export async function pathologyRoutes(app: FastifyInstance): Promise<void> {
  // Lecture : tout le personnel médical.
  app.get('/pathologies', { preHandler: [app.authenticate, app.requireMedecin] }, async (req) => {
    const { specialty, q } = req.query as { specialty?: string; q?: string };
    const db = getDb();
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (specialty) {
      clauses.push('specialty = ?');
      args.push(specialty);
    }
    if (q && q.trim()) {
      clauses.push('(label LIKE ? OR code LIKE ?)');
      args.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(`SELECT * FROM pathologies ${where} ORDER BY code, label LIMIT 500`).all(...args);
  });

  // Gestion du catalogue : admin.
  const guard = { preHandler: [app.authenticate, app.requireRole('ADMIN')] };

  app.post('/pathologies', guard, async (req, reply) => {
    const body = parse(bodySchema, req.body);
    const db = getDb();
    const info = db
      .prepare('INSERT INTO pathologies (specialty, code, label) VALUES (?, ?, ?)')
      .run(body.specialty, body.code ?? null, body.label);
    reply.code(201);
    return db.prepare('SELECT * FROM pathologies WHERE id = ?').get(info.lastInsertRowid);
  });

  app.patch('/pathologies/:id', guard, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(bodySchema.partial(), req.body);
    const db = getDb();
    const existing = db.prepare('SELECT * FROM pathologies WHERE id = ?').get(Number(id)) as
      | { id: number; specialty: string; code: string | null; label: string }
      | undefined;
    if (!existing) throw notFound('Pathologie introuvable');
    const m = { ...existing, ...body };
    db.prepare('UPDATE pathologies SET specialty = ?, code = ?, label = ? WHERE id = ?').run(
      m.specialty,
      m.code ?? null,
      m.label,
      existing.id,
    );
    return db.prepare('SELECT * FROM pathologies WHERE id = ?').get(existing.id);
  });

  app.delete('/pathologies/:id', guard, async (req) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const used = db
      .prepare('SELECT COUNT(*) AS n FROM consultation_pathologies WHERE pathology_id = ?')
      .get(Number(id)) as { n: number };
    if (used.n > 0) {
      // Conserve l'historique : on n'efface pas une pathologie déjà utilisée.
      throw notFound('Pathologie utilisée dans des consultations — suppression impossible.');
    }
    const info = db.prepare('DELETE FROM pathologies WHERE id = ?').run(Number(id));
    if (info.changes === 0) throw notFound('Pathologie introuvable');
    return { deleted: true };
  });
}
