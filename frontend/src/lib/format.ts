import type {
  AppointmentStatus,
  ExamCategory,
  InvoiceStatus,
  PaymentMethod,
  ReferralStatus,
} from './types';

/** Format an integer amount of FCFA, e.g. 12500 -> "12 500 FCFA". */
export function fcfa(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${n.toLocaleString('fr-FR').replace(/ /g, ' ')} FCFA`;
}

/** Compute an age in years from an ISO date (YYYY-MM-DD). */
export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Human age label: "3 ans", "8 mois" for infants, or "—". */
export function ageLabel(birthDate: string | null): string {
  if (!birthDate) return '—';
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return '—';
  const years = ageFrom(birthDate);
  if (years === null) return '—';
  if (years >= 2) return `${years} ans`;
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months--;
  return `${Math.max(0, months)} mois`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export const sexLabel: Record<string, string> = { M: 'Masculin', F: 'Féminin' };

export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  PLANIFIE: 'Planifié',
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  IMPAYEE: 'Impayée',
  PARTIELLE: 'Partielle',
  PAYEE: 'Payée',
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARTE: 'Carte',
  AUTRE: 'Autre',
};

export const referralStatusLabel: Record<ReferralStatus, string> = {
  EN_ATTENTE: 'En attente',
  PLANIFIE: 'Planifiée',
  TERMINE: 'Terminée',
  ANNULE: 'Annulée',
};

export const examCategoryLabel: Record<ExamCategory, string> = {
  LABORATOIRE: 'Laboratoire',
  IMAGERIE: 'Imagerie',
};

export const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS[weekday] ?? '—';
}
