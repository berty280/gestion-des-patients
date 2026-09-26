import type { Role, Specialty } from './types';

const RANK: Record<Role, number> = {
  ACCUEIL: 1,
  GENERALISTE: 2,
  SPECIALISTE: 2,
  ADMIN: 3,
};

export function roleAtLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

export function isMedecin(role: Role | undefined): boolean {
  return role === 'GENERALISTE' || role === 'SPECIALISTE' || role === 'ADMIN';
}

export const roleLabel: Record<Role, string> = {
  ACCUEIL: 'Accueil',
  GENERALISTE: 'Médecin généraliste',
  SPECIALISTE: 'Spécialiste',
  ADMIN: 'Administrateur',
};

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
