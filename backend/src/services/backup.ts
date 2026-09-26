import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/connection.js';

const PREFIX = 'clinique-';
const SUFFIX = '.db';

/** Nom de fichier autorisé pour une sauvegarde (garde-fou anti-traversée). */
export const BACKUP_NAME_RE = /^clinique-\d{8}-\d{6}\.db$/;

export interface BackupInfo {
  file: string;
  size: number;
  created_at: string;
}

function stamp(d = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** Effectue une sauvegarde cohérente de la base (compatible WAL) vers le dossier configuré. */
export async function backupNow(): Promise<BackupInfo> {
  mkdirSync(config.backup.dir, { recursive: true });
  const file = `${PREFIX}${stamp()}${SUFFIX}`;
  const dest = join(config.backup.dir, file);
  // db.backup() réalise une copie en ligne, sûre même pendant l'utilisation.
  await getDb().backup(dest);
  rotate();
  const st = statSync(dest);
  return { file, size: st.size, created_at: st.mtime.toISOString() };
}

/** Liste les sauvegardes existantes, de la plus récente à la plus ancienne. */
export function listBackups(): BackupInfo[] {
  let names: string[];
  try {
    names = readdirSync(config.backup.dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => BACKUP_NAME_RE.test(n))
    .map((file) => {
      const st = statSync(join(config.backup.dir, file));
      return { file, size: st.size, created_at: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.file < b.file ? 1 : -1));
}

/** Chemin absolu d'une sauvegarde nommée, ou null si le nom est invalide. */
export function backupPath(name: string): string | null {
  if (!BACKUP_NAME_RE.test(name)) return null;
  return join(config.backup.dir, name);
}

/** Supprime les sauvegardes au-delà du nombre à conserver. */
function rotate(): void {
  const keep = Math.max(1, config.backup.keep);
  const all = listBackups();
  for (const b of all.slice(keep)) {
    try {
      unlinkSync(join(config.backup.dir, b.file));
    } catch {
      /* ignore */
    }
  }
}

interface Logger {
  info: (msg: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

/** Démarre la sauvegarde automatique (au boot puis à intervalle régulier). */
export function startBackupScheduler(log: Logger): void {
  if (!config.backup.enabled) {
    log.info('[backup] Sauvegarde automatique désactivée (BACKUP_ENABLED=false).');
    return;
  }
  const run = () =>
    backupNow()
      .then((b) => log.info(`[backup] Sauvegarde créée : ${b.file} (${b.size} octets)`))
      .catch((e) => log.error(e, '[backup] Échec de la sauvegarde'));

  if (config.backup.onStart) setTimeout(run, 5000);
  const everyMs = Math.max(1, config.backup.intervalHours) * 3600 * 1000;
  const timer = setInterval(run, everyMs);
  timer.unref?.();
  log.info(
    `[backup] Sauvegarde automatique toutes les ${config.backup.intervalHours} h ` +
      `vers ${config.backup.dir} (conservation : ${config.backup.keep}).`,
  );
}
