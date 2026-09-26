-- Clinique — schéma initial (gestion des patients d'un centre de santé).
-- Les valeurs d'énum restent en français (cohérence métier).

PRAGMA foreign_keys = ON;

-- users (id, nom, email, mot_de_passe_hash, rôle, actif)
-- Rôles : ACCUEIL (secrétariat) < SOIGNANT (infirmier/médecin) < ADMIN (responsable).
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('ACCUEIL', 'SOIGNANT', 'ADMIN')),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- patients — dossier patient
CREATE TABLE patients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  code              TEXT    UNIQUE,          -- numéro de dossier lisible, ex. P-00001
  first_name        TEXT    NOT NULL,
  last_name         TEXT    NOT NULL,
  sex               TEXT    CHECK (sex IN ('M', 'F')),
  birth_date        TEXT,                    -- ISO date YYYY-MM-DD
  phone             TEXT,
  address           TEXT,
  blood_group       TEXT,                    -- ex. 'O+', 'A-'
  allergies         TEXT,
  emergency_contact TEXT,
  notes             TEXT,                    -- antécédents / notes générales
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- consultations — historique médical, une ligne par consultation
CREATE TABLE consultations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  motif         TEXT,
  symptoms      TEXT,
  diagnosis     TEXT,
  treatment     TEXT,                        -- prescription / traitement
  weight_kg     REAL,
  height_cm     REAL,
  temperature_c REAL,
  bp_systolic   INTEGER,                     -- tension systolique
  bp_diastolic  INTEGER,                     -- tension diastolique
  pulse         INTEGER,                     -- fréquence cardiaque
  notes         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- appointments — rendez-vous & file d'attente du jour
CREATE TABLE appointments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id   INTEGER NOT NULL REFERENCES patients(id),
  scheduled_at TEXT    NOT NULL,             -- ISO datetime
  reason       TEXT,
  status       TEXT    NOT NULL DEFAULT 'PLANIFIE'
                 CHECK (status IN ('PLANIFIE', 'EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ANNULE')),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- invoices — factures (montants en FCFA, entiers)
CREATE TABLE invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT    UNIQUE,            -- ex. F-00001
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
  unit_price INTEGER NOT NULL DEFAULT 0 CHECK (unit_price >= 0)  -- FCFA
);

CREATE TABLE payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL CHECK (amount > 0),                -- FCFA
  method     TEXT    NOT NULL DEFAULT 'ESPECES'
               CHECK (method IN ('ESPECES', 'MOBILE_MONEY', 'CARTE', 'AUTRE')),
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_patients_names        ON patients(last_name, first_name);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_created ON consultations(created_at);
CREATE INDEX idx_appointments_patient  ON appointments(patient_id);
CREATE INDEX idx_appointments_sched    ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status   ON appointments(status);
CREATE INDEX idx_invoices_patient      ON invoices(patient_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice      ON payments(invoice_id);
