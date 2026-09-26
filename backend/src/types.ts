export type Role = 'ACCUEIL' | 'SOIGNANT' | 'ADMIN';
export type Sex = 'M' | 'F';
export type AppointmentStatus =
  | 'PLANIFIE'
  | 'EN_ATTENTE'
  | 'EN_COURS'
  | 'TERMINE'
  | 'ANNULE';
export type PaymentMethod = 'ESPECES' | 'MOBILE_MONEY' | 'CARTE' | 'AUTRE';
export type InvoiceStatus = 'IMPAYEE' | 'PARTIELLE' | 'PAYEE';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  active: number;
  created_at: string;
}

export interface PatientRow {
  id: number;
  code: string | null;
  first_name: string;
  last_name: string;
  sex: Sex | null;
  birth_date: string | null;
  phone: string | null;
  address: string | null;
  blood_group: string | null;
  allergies: string | null;
  emergency_contact: string | null;
  notes: string | null;
  created_at: string;
}

export interface ConsultationRow {
  id: number;
  patient_id: number;
  user_id: number;
  motif: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  treatment: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  temperature_c: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  notes: string | null;
  created_at: string;
}

export interface AppointmentRow {
  id: number;
  patient_id: number;
  scheduled_at: string;
  reason: string | null;
  status: AppointmentStatus;
  user_id: number;
  created_at: string;
}

export interface InvoiceRow {
  id: number;
  code: string | null;
  patient_id: number;
  consultation_id: number | null;
  user_id: number;
  note: string | null;
  created_at: string;
}

export interface InvoiceItemRow {
  id: number;
  invoice_id: number;
  label: string;
  quantity: number;
  unit_price: number;
}

export interface PaymentRow {
  id: number;
  invoice_id: number;
  amount: number;
  method: PaymentMethod;
  user_id: number;
  created_at: string;
}

export interface JwtUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}
