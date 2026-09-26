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

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  specialty: Specialty | null;
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
}

export interface PathologyRow {
  id: number;
  specialty: string; // Specialty | 'GENERAL'
  code: string | null; // code CIM-10
  label: string;
  created_at: string;
}

export interface PrescriptionRow {
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

export interface ExamOrderRow {
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

export interface ReferralRow {
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
}

export interface SpecialistScheduleRow {
  id: number;
  user_id: number;
  weekday: number; // 0=dimanche … 6=samedi (JS getDay)
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  created_at: string;
}

export interface AppointmentRow {
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

export interface AttachmentRow {
  id: number;
  patient_id: number;
  exam_order_id: number | null;
  filename: string;
  mime: string;
  size: number;
  label: string | null;
  uploaded_by: number | null;
  created_at: string;
}

export interface JwtUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  specialty: Specialty | null;
}
