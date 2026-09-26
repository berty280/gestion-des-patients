-- Clinique — schéma initial (gestion des patients d'un centre de santé).
-- Généralistes + spécialistes (kiné, ophtalmo, dermato, gynéco, radiologue),
-- dossier numérique unifié, prescriptions, examens, références, calendrier des
-- spécialistes, facturation. Les valeurs d'énum restent en français.

PRAGMA foreign_keys = ON;

-- users : personnel du centre.
-- Rôles : ACCUEIL, GENERALISTE, SPECIALISTE, ADMIN.
-- `specialty` renseigné uniquement pour les spécialistes.
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('ACCUEIL', 'GENERALISTE', 'SPECIALISTE', 'ADMIN')),
  specialty     TEXT    CHECK (specialty IN ('KINE', 'OPHTALMOLOGIE', 'DERMATOLOGIE', 'GYNECOLOGIE', 'RADIOLOGIE')),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- patients — dossier patient. Identifiable par (nom + date de naissance) ou téléphone.
CREATE TABLE patients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  code              TEXT    UNIQUE,          -- numéro de dossier lisible, ex. P-00001
  first_name        TEXT    NOT NULL,
  last_name         TEXT    NOT NULL,
  sex               TEXT    CHECK (sex IN ('M', 'F')),
  birth_date        TEXT,                    -- ISO date YYYY-MM-DD
  phone             TEXT,
  address           TEXT,
  blood_group       TEXT,
  allergies         TEXT,
  emergency_contact TEXT,
  notes             TEXT,                    -- antécédents / notes générales
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- pathologies — catalogue CIM-10 / OMS, par spécialité (ou 'GENERAL').
CREATE TABLE pathologies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  specialty  TEXT    NOT NULL,               -- Specialty | 'GENERAL'
  code       TEXT,                           -- code CIM-10 (ex. 'N80')
  label      TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- consultations — générales et spécialisées, rattachées au dossier patient.
CREATE TABLE consultations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  type          TEXT    NOT NULL DEFAULT 'GENERALE' CHECK (type IN ('GENERALE', 'SPECIALISTE')),
  specialty     TEXT,                        -- renseigné pour une consultation spécialiste
  referral_id   INTEGER REFERENCES referrals(id),
  motif         TEXT,
  symptoms      TEXT,
  weight_kg     REAL,
  height_cm     REAL,
  temperature_c REAL,
  bp_systolic   INTEGER,
  bp_diastolic  INTEGER,
  pulse         INTEGER,
  findings      TEXT,                        -- examen clinique / constatations / interprétation
  procedures    TEXT,                        -- actes / thérapies exécutées (kiné, etc.)
  diagnosis     TEXT,
  summary       TEXT,                        -- résumé de fin de séance
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- pathologies retenues pour une consultation (plusieurs possibles).
CREATE TABLE consultation_pathologies (
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  pathology_id    INTEGER NOT NULL REFERENCES pathologies(id),
  PRIMARY KEY (consultation_id, pathology_id)
);

-- prescriptions de médicaments.
CREATE TABLE prescriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  medication      TEXT    NOT NULL,
  dosage          TEXT,
  frequency       TEXT,
  duration        TEXT,
  instructions    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- examens prescrits (laboratoire + imagerie).
CREATE TABLE exam_orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  category        TEXT    NOT NULL CHECK (category IN ('LABORATOIRE', 'IMAGERIE')),
  label           TEXT    NOT NULL,
  notes           TEXT,
  status          TEXT    NOT NULL DEFAULT 'PRESCRIT' CHECK (status IN ('PRESCRIT', 'REALISE', 'ANNULE')),
  result          TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- références vers un spécialiste (du généraliste).
CREATE TABLE referrals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  from_user_id    INTEGER NOT NULL REFERENCES users(id),
  consultation_id INTEGER REFERENCES consultations(id),
  to_specialty    TEXT    NOT NULL,
  to_user_id      INTEGER REFERENCES users(id),
  appointment_id  INTEGER REFERENCES appointments(id),
  indications     TEXT,
  status          TEXT    NOT NULL DEFAULT 'EN_ATTENTE' CHECK (status IN ('EN_ATTENTE', 'PLANIFIE', 'TERMINE', 'ANNULE')),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- calendrier hebdomadaire des spécialistes (jours de prestation au centre).
CREATE TABLE specialist_schedules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=dimanche … 6=samedi
  start_time TEXT    NOT NULL DEFAULT '08:00',
  end_time   TEXT    NOT NULL DEFAULT '16:00',
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- appointments — file d'attente & rendez-vous (généralistes et spécialistes).
CREATE TABLE appointments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id       INTEGER NOT NULL REFERENCES patients(id),
  scheduled_at     TEXT    NOT NULL,
  reason           TEXT,
  status           TEXT    NOT NULL DEFAULT 'PLANIFIE'
                     CHECK (status IN ('PLANIFIE', 'EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ANNULE')),
  user_id          INTEGER NOT NULL REFERENCES users(id),        -- créateur
  assigned_user_id INTEGER REFERENCES users(id),                 -- médecin/spécialiste concerné
  specialty        TEXT,
  referral_id      INTEGER REFERENCES referrals(id),
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- invoices — factures (montants en FCFA, entiers)
CREATE TABLE invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    UNIQUE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  consultation_id INTEGER REFERENCES consultations(id),
  user_id         INTEGER NOT NULL REFERENCES users(id),
  note            TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE invoice_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0)
);

CREATE TABLE payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  method     TEXT    NOT NULL DEFAULT 'ESPECES'
               CHECK (method IN ('ESPECES', 'MOBILE_MONEY', 'CARTE', 'AUTRE')),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_patients_names        ON patients(last_name, first_name);
CREATE INDEX idx_patients_phone        ON patients(phone);
CREATE INDEX idx_pathologies_specialty ON pathologies(specialty);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_created ON consultations(created_at);
CREATE INDEX idx_consultations_type    ON consultations(type, specialty);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_exam_orders_patient   ON exam_orders(patient_id);
CREATE INDEX idx_referrals_patient     ON referrals(patient_id);
CREATE INDEX idx_referrals_to          ON referrals(to_user_id, status);
CREATE INDEX idx_referrals_specialty   ON referrals(to_specialty, status);
CREATE INDEX idx_schedules_user        ON specialist_schedules(user_id);
CREATE INDEX idx_appointments_patient  ON appointments(patient_id);
CREATE INDEX idx_appointments_sched    ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status   ON appointments(status);
CREATE INDEX idx_appointments_assigned ON appointments(assigned_user_id);
CREATE INDEX idx_invoices_patient      ON invoices(patient_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice      ON payments(invoice_id);
