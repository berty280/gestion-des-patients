import { useEffect, useState } from 'react';
import { api } from './api';

let cached: string | null = null;

/** Nom du centre de santé (depuis /api/config), mis en cache pour la session. */
export function useClinicName(): string {
  const [name, setName] = useState(cached ?? 'Centre de Santé');

  useEffect(() => {
    if (cached) return;
    api<{ clinicName: string }>('/config')
      .then((c) => {
        cached = c.clinicName || 'Centre de Santé';
        setName(cached);
      })
      .catch(() => {});
  }, []);

  return name;
}
