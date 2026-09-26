import type { Role, Specialty } from '../types.js';

// Généraliste et spécialiste sont au même niveau (personnel médical), au-dessus
// de l'accueil, en dessous de l'admin.
const RANK: Record<Role, number> = {
  ACCUEIL: 1,
  GENERALISTE: 2,
  SPECIALISTE: 2,
  ADMIN: 3,
};

export function roleRank(role: Role): number {
  return RANK[role] ?? 0;
}

/** True when `role` is at least as privileged as `min` (échelle linéaire). */
export function roleAtLeast(role: Role, min: Role): boolean {
  return roleRank(role) >= roleRank(min);
}

/** Personnel médical (peut lire/créer des consultations). */
export function isMedecin(role: Role): boolean {
  return role === 'GENERALISTE' || role === 'SPECIALISTE' || role === 'ADMIN';
}

export const SPECIALTIES: Specialty[] = [
  'KINE',
  'OPHTALMOLOGIE',
  'DERMATOLOGIE',
  'GYNECOLOGIE',
  'RADIOLOGIE',
];

export const specialtyLabel: Record<Specialty, string> = {
  KINE: 'Kinésithérapie',
  OPHTALMOLOGIE: 'Ophtalmologie',
  DERMATOLOGIE: 'Dermatologie',
  GYNECOLOGIE: 'Gynécologie',
  RADIOLOGIE: 'Radiologie / Échographie',
};
