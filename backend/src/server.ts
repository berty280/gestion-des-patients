import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { getDb } from './db/connection.js';
import { registerAuth } from './auth/plugin.js';
import { authRoutes } from './auth/routes.js';
import { patientRoutes } from './routes/patients.js';
import { consultationRoutes } from './routes/consultations.js';
import { appointmentRoutes } from './routes/appointments.js';
import { invoiceRoutes } from './routes/invoices.js';
import { userRoutes } from './routes/users.js';
import { reportRoutes } from './routes/reports.js';
import { specialtyRoutes } from './routes/specialties.js';
import { pathologyRoutes } from './routes/pathologies.js';
import { scheduleRoutes } from './routes/schedules.js';
import { referralRoutes } from './routes/referrals.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    },
  });

  await app.register(cors, { origin: config.corsOrigin, credentials: true });
  await registerAuth(app);

  // All API endpoints live under /api so the SPA can own the rest of the paths.
  await app.register(
    async (api) => {
      api.get('/health', async () => {
        const db = getDb();
        const row = db.prepare('SELECT 1 AS ok').get() as { ok: number };
        const migrations = db
          .prepare(
            "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = '_migrations'",
          )
          .get() as { n: number };
        return {
          status: 'ok',
          clinic: config.clinicName,
          db: row.ok === 1 ? 'up' : 'down',
          migrationsTable: migrations.n === 1,
          time: new Date().toISOString(),
        };
      });

      // Exposé au frontend pour l'affichage (nom du centre).
      api.get('/config', async () => ({ clinicName: config.clinicName }));

      await api.register(authRoutes);
      await api.register(patientRoutes);
      await api.register(consultationRoutes);
      await api.register(appointmentRoutes);
      await api.register(invoiceRoutes);
      await api.register(userRoutes);
      await api.register(reportRoutes);
      await api.register(specialtyRoutes);
      await api.register(pathologyRoutes);
      await api.register(scheduleRoutes);
      await api.register(referralRoutes);
    },
    { prefix: '/api' },
  );

  // Serve the built PWA (single-port mode) when it exists, with SPA fallback.
  if (config.frontendDist && existsSync(config.frontendDist)) {
    await app.register(fastifyStatic, { root: config.frontendDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api')) {
        return reply.type('text/html').sendFile('index.html');
      }
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Route inconnue' });
    });
  }

  return app;
}
