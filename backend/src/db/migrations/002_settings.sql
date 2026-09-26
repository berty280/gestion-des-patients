-- Paramètres de l'application (identité du centre : nom, adresse, téléphone, logo).
-- Stockés en base pour être modifiables par l'admin depuis l'application.
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
