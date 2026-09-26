import { useEffect, useState } from 'react';
import { api } from './api';

export interface ClinicInfo {
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicLogo: string | null;
}

const DEFAULT: ClinicInfo = {
  clinicName: 'Centre de Santé',
  clinicAddress: 'Yaoundé, Cameroun',
  clinicPhone: '',
  clinicLogo: null,
};

let cached: ClinicInfo | null = null;

/** Identité du centre (depuis /api/config), mise en cache pour la session. */
export function useClinicInfo(): ClinicInfo {
  const [info, setInfo] = useState<ClinicInfo>(cached ?? DEFAULT);

  useEffect(() => {
    if (cached) return;
    api<ClinicInfo>('/config')
      .then((c) => {
        cached = { ...DEFAULT, ...c };
        setInfo(cached);
      })
      .catch(() => {});
  }, []);

  return info;
}

/** Force le rechargement de l'identité (après modification dans Paramètres). */
export function clearClinicInfoCache(): void {
  cached = null;
}
