import { getDb } from '../db/connection.js';
import { config } from '../config.js';

export interface ClinicInfo {
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicLogo: string | null;
}

function get(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string | null }
    | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string | null): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value);
}

/** Identité publique du centre : réglages en base, avec repli sur la config `.env`. */
export function getClinicInfo(): ClinicInfo {
  return {
    clinicName: get('clinic_name') || config.clinicName,
    clinicAddress: get('clinic_address') ?? config.clinicAddress,
    clinicPhone: get('clinic_phone') ?? config.clinicPhone,
    clinicLogo: get('clinic_logo') || null,
  };
}
