import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv();

function env(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Resolve a path from an env var against the backend package root. */
function resolvePath(value: string): string {
  return resolve(process.cwd(), value);
}

export const config = {
  port: Number(env('PORT', '3000')),
  host: env('HOST', '0.0.0.0'),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  databasePath: resolvePath(env('DATABASE_PATH', './data/clinique.db')),
  // Built frontend served by the backend in single-port mode (empty string disables it).
  frontendDist: resolvePath(env('FRONTEND_DIST', '../frontend/dist')),
  jwtSecret: env('JWT_SECRET', 'change-me-in-production'),
  seedDefaultPassword: env('SEED_DEFAULT_PASSWORD', 'clinique123'),
  clinicName: env('CLINIC_NAME', 'Centre de Santé'),
  backup: {
    // Sauvegarde automatique de la base SQLite.
    enabled: env('BACKUP_ENABLED', 'true') !== 'false',
    dir: resolvePath(env('BACKUP_DIR', './data/backups')),
    intervalHours: Number(env('BACKUP_INTERVAL_HOURS', '24')),
    keep: Number(env('BACKUP_KEEP', '30')),
    onStart: env('BACKUP_ON_START', 'true') !== 'false',
  },
} as const;

export type AppConfig = typeof config;
