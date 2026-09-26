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

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  active?: number;
  created_at?: string;
}

export interface Patient {
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

export interface PatientDetail extends Patient {
  consultations_count: number;
  last_visit: string | null;
}

export interface Consultation {
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
  first_name?: string;
  last_name?: string;
  patient_code?: string | null;
  user_name?: string | null;
}

export interface Appointment {
  id: number;
  patient_id: number;
  scheduled_at: string;
  reason: string | null;
  status: AppointmentStatus;
  user_id: number;
  created_at: string;
  first_name: string;
  last_name: string;
  patient_code: string | null;
  patient_phone: string | null;
  user_name: string | null;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  label: string;
  quantity: number;
  unit_price: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  method: PaymentMethod;
  user_id: number;
  created_at: string;
  user_name?: string | null;
}

export interface Invoice {
  id: number;
  code: string | null;
  patient_id: number;
  consultation_id: number | null;
  user_id: number;
  note: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  patient_code: string | null;
  total: number;
  paid: number;
  status: InvoiceStatus;
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
  payments: Payment[];
}

export interface DashboardStats {
  patients_total: number;
  consultations_today: number;
  appointments_today: number;
  queue_waiting: number;
  invoices_unpaid: number;
  revenue_today: number;
}

export interface ActivityReport {
  date: string;
  new_patients: number;
  consultations_count: number;
  revenue: number;
  consultations: Array<{
    id: number;
    created_at: string;
    motif: string | null;
    diagnosis: string | null;
    first_name: string;
    last_name: string;
    patient_code: string | null;
    user_name: string | null;
  }>;
  payments: Array<{
    id: number;
    amount: number;
    method: PaymentMethod;
    created_at: string;
    invoice_code: string | null;
    first_name: string;
    last_name: string;
  }>;
}
