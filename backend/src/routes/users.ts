import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db/connection.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { UserRow } from '../types.js';

const roleEnum = z.enum(['ACCUEIL', 'SOIGNANT', 'ADMIN']);

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email(),
  role: roleEnum,
  password: z.string().min(6).max(200),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  role: roleEnum.optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).max(200).optional(),
});

function publicUser(u: UserRow) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    created_at: u.created_at,
  };
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [app.authenticate, app.requireRole('ADMIN')] };

  app.get('/users', guard, async () => {
    const rows = getDb().prepare('SELECT * FROM users ORDER BY role, name').all() as UserRow[];
    return rows.map(publicUser);
  });

  app.post('/users', guard, async (req, reply) => {
    const body = parse(createSchema, req.body);
    const db = getDb();
    const email = body.email.toLowerCase();
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      throw conflict('Un utilisateur avec cet email existe déjà');
    }
    const hash = bcrypt.hashSync(body.password, 10);
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)')
      .run(body.name, email, hash, body.role);
    reply.code(201);
    return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow);
  });

  app.patch('/users/:id', guard, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(updateSchema, req.body);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) as
      | UserRow
      | undefined;
    if (!user) throw notFound('Utilisateur introuvable');

    // Ne jamais verrouiller l'accès : ne pas désactiver/rétrograder le dernier admin actif.
    const activeAdmins = (
      db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='ADMIN' AND active=1").get() as {
        n: number;
      }
    ).n;
    const isLastAdmin = user.role === 'ADMIN' && user.active === 1 && activeAdmins <= 1;
    if (isLastAdmin && (body.active === false || (body.role && body.role !== 'ADMIN'))) {
      throw badRequest('Impossible de rétrograder ou désactiver le dernier administrateur actif');
    }

    const name = body.name ?? user.name;
    const role = body.role ?? user.role;
    const active = body.active === undefined ? user.active : body.active ? 1 : 0;
    const hash = body.password ? bcrypt.hashSync(body.password, 10) : user.password_hash;

    db.prepare('UPDATE users SET name=?, role=?, active=?, password_hash=? WHERE id=?').run(
      name,
      role,
      active,
      hash,
      user.id,
    );
    return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow);
  });
}
