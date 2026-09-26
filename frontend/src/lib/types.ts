export type Role = 'ACCUEIL' | 'GENERALISTE' | 'SPECIALISTE' | 'ADMIN';
export type Specialty =
  | 'KINE'
  | 'OPHTALMOLOGIE'
  | 'DERMATOLOGIE'
  | 'GYNECOLOGIE'
  | 'RADIOLOGIE';
export type Sex = 'M' | 'F';
export type ConsultationType = 'GENERALE' | 'SPECIALISTE';
export type AppointmentStatus =
  | 'PLANIFIE'
  | 'EN_ATTENTE'
  | 'EN_COURS'
  | 'TERMINE'
  | 'ANNULE';
export type ReferralStatus = 'EN_ATTENTE' | 'PLANIFIE' | 'TERMINE' | 'ANNULE';
export type ExamCategory = 'LABORATOIRE' | 'IMAGERIE';
export type ExamStatus = 'PRESCRIT' | 'REALISE' | 'ANNULE';
export type PaymentMethod = 'ESPECES' | 'MOBILE_MONEY' | 'CARTE' | 'AUTRE';
export type InvoiceStatus = 'IMPAYEE' | 'PARTIELLE' | 'PAYEE';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  specialty?: Specialty | null;
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

export interface Pathology {
  id: number;
  specialty: string;
  code: string | null;
  label: string;
  created_at?: string;
}

export interface Prescription {
  id: number;
  consultation_id: number;
  patient_id: number;
  medication: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  created_at: string;
}

export interface ExamOrder {
  id: number;
  consultation_id: number;
  patient_id: number;
  category: ExamCategory;
  label: string;
  notes: string | null;
  status: ExamStatus;
  result: string | null;
  created_at: string;
}

export interface Consultation {
  id: number;
  patient_id: number;
  user_id: number;
  type: ConsultationType;
  specialty: Specialty | null;
  referral_id: number | null;
  motif: string | null;
  symptoms: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  temperature_c: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  findings: string | null;
  procedures: string | null;
  diagnosis: string | null;
  summary: string | null;
  notes: string | null;
  created_at: string;
  first_name?: string;
  last_name?: string;
  patient_code?: string | null;
  user_name?: string | null;
  pathologies?: Pathology[];
  prescriptions?: Prescription[];
  exams?: ExamOrder[];
}

export interface Referral {
  id: number;
  patient_id: number;
  from_user_id: number;
  consultation_id: number | null;
  to_specialty: Specialty;
  to_user_id: number | null;
  appointment_id: number | null;
  indications: string | null;
  status: ReferralStatus;
  created_at: string;
  first_name?: string;
  last_name?: string;
  patient_code?: string | null;
  from_user_name?: string | null;
  to_user_name?: string | null;
  appointment_at?: string | null;
}

export interface Schedule {
  id: number;
  user_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface Specialist {
  id: number;
  name: string;
  specialty: Specialty;
  weekdays: number[];
  schedules: Schedule[];
}

export interface SpecialtyOption {
  code: Specialty;
  label: string;
}

export interface Appointment {
  id: number;
  patient_id: number;
  scheduled_at: string;
  reason: string | null;
  status: AppointmentStatus;
  user_id: number;
  assigned_user_id: number | null;
  specialty: Specialty | null;
  referral_id: number | null;
  created_at: string;
  first_name: string;
  last_name: string;
  patient_code: string | null;
  patient_phone: string | null;
  user_name: string | null;
  assigned_name: string | null;
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

export interface PatientRecord {
  patient: Patient;
  consultations: Consultation[];
  referrals: Referral[];
  prescriptions: Prescription[];
  exams: ExamOrder[];
}

export interface DashboardStats {
  patients_total: number;
  consultations_today: number;
  appointments_today: number;
  queue_waiting: number;
  invoices_unpaid: number;
  revenue_today: number;
  my_referrals_pending: number;
  my_appointments_today: number;
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
