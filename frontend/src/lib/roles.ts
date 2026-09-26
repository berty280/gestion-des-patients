import type { Role } from './types';

const RANK: Record<Role, number> = { ACCUEIL: 1, SOIGNANT: 2, ADMIN: 3 };

export function roleAtLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

export const roleLabel: Record<Role, string> = {
  ACCUEIL: 'Accueil',
  SOIGNANT: 'Soignant',
  ADMIN: 'Administrateur',
};
