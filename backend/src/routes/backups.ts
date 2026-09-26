import type { FastifyInstance } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import { backupNow, backupPath, listBackups } from '../services/backup.js';
import { config } from '../config.js';
import { notFound } from '../lib/errors.js';

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  // Sauvegardes — réservé à l'administrateur.
  const guard = { preHandler: [app.authenticate, app.requireRole('ADMIN')] };

  app.get('/backups', guard, async () => {
    return { dir: config.backup.dir, enabled: config.backup.enabled, items: listBackups() };
  });

  app.post('/backups', guard, async (_req, reply) => {
    const info = await backupNow();
    reply.code(201);
    return info;
  });

  app.get('/backups/:name/download', guard, async (req, reply) => {
    const { name } = req.params as { name: string };
    const path = backupPath(name);
    if (!path || !existsSync(path)) throw notFound('Sauvegarde introuvable');
    reply
      .header('Content-Disposition', `attachment; filename="${name}"`)
      .type('application/octet-stream');
    return reply.send(createReadStream(path));
  });
}
