-- Pièces jointes du dossier patient (résultats d'examens, comptes-rendus PDF…).
-- Le contenu est stocké dans la base (BLOB) afin d'être inclus dans les sauvegardes.
CREATE TABLE attachments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id    INTEGER NOT NULL REFERENCES patients(id),
  exam_order_id INTEGER REFERENCES exam_orders(id),
  filename      TEXT    NOT NULL,             -- nom d'origine du fichier
  mime          TEXT    NOT NULL,             -- type MIME (application/pdf, image/…)
  size          INTEGER NOT NULL,             -- taille en octets
  label         TEXT,                         -- description libre (ex. « NFS », « Écho pelvienne »)
  content       BLOB    NOT NULL,             -- contenu du fichier
  uploaded_by   INTEGER REFERENCES users(id),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_attachments_patient ON attachments(patient_id);
CREATE INDEX idx_attachments_exam    ON attachments(exam_order_id);
