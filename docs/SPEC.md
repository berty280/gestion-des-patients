# Clinique — Spécification (MVP)

Gestion des patients d'un centre de santé. Application web locale (PWA) mono-poste,
en français, montants en **FCFA**.

## 1. Objectifs
Permettre à un petit centre de santé de :
1. Tenir le **dossier** de chaque patient (identité, contact, groupe sanguin,
   allergies, antécédents).
2. Enregistrer les **consultations** (motif, symptômes, signes vitaux, diagnostic,
   traitement) et consulter l'historique médical.
3. Gérer la **file d'attente** du jour et les **rendez-vous**.
4. **Facturer** les actes et médicaments, et suivre les **paiements**.

## 2. Rôles & permissions
Hiérarchie `ACCUEIL < SOIGNANT < ADMIN`.

| Fonction                                   | Accueil | Soignant | Admin |
|--------------------------------------------|:------:|:--------:|:-----:|
| Créer / éditer un patient                  |   ✔    |    ✔     |   ✔   |
| File d'attente & rendez-vous               |   ✔    |    ✔     |   ✔   |
| Facturation & encaissements                |   ✔    |    ✔     |   ✔   |
| Consultations (lecture / création)         |        |    ✔     |   ✔   |
| Supprimer un patient / une facture         |        |          |   ✔   |
| Utilisateurs                               |        |          |   ✔   |
| Rapports d'activité détaillés              |        |          |   ✔   |

Le tableau de bord (indicateurs du jour) est accessible à tous les rôles.

> **Confidentialité médicale** : le contenu des consultations (diagnostic,
> traitement) n'est visible que des rôles Soignant et Admin.

## 3. Modèle de données
Tables : `users`, `patients`, `consultations`, `appointments`, `invoices`,
`invoice_items`, `payments` (+ `_migrations`). Voir
`backend/src/db/migrations/001_init.sql`.

- **patients** : identité, sexe (`M|F`), date de naissance, téléphone, adresse,
  groupe sanguin, allergies, contact d'urgence, antécédents. `code` lisible `P-00001`.
- **consultations** : rattachées à un patient et à l'utilisateur soignant ;
  signes vitaux (poids, taille, température, tension systolique/diastolique, pouls),
  motif, symptômes, diagnostic, traitement, notes. Journal append-only par patient.
- **appointments** : `scheduled_at` (date+heure), `reason`, `status`
  (`PLANIFIE → EN_ATTENTE → EN_COURS → TERMINE`, ou `ANNULE`). La file d'attente est
  simplement l'ensemble des rendez-vous du jour triés par heure.
- **invoices / invoice_items / payments** : une facture porte des lignes
  (libellé, quantité, prix unitaire en FCFA) et des paiements
  (montant, mode `ESPECES|MOBILE_MONEY|CARTE|AUTRE`). Le **total** et le **statut**
  (`IMPAYEE|PARTIELLE|PAYEE`) sont **dérivés** (jamais stockés). Un paiement ne peut
  pas dépasser le reste à payer.

## 4. API (préfixe `/api`)
- `POST /auth/login`, `GET /auth/me`
- `GET/POST /patients`, `GET/PATCH /patients/:id`, `DELETE /patients/:id` (admin)
- `GET/POST /consultations`, `GET/PATCH /consultations/:id` (soignant+)
  — filtre `?patient_id=`
- `GET/POST /appointments`, `PATCH/DELETE /appointments/:id` — filtres `?date=`, `?status=`
- `GET/POST /invoices`, `GET /invoices/:id`, `POST /invoices/:id/payments`,
  `DELETE /invoices/:id` (admin) — filtres `?status=`, `?patient_id=`
- `GET/POST/PATCH /users` (admin)
- `GET /reports/dashboard` (tous), `GET /reports/activity?date=` (admin)

## 5. Contraintes techniques
- Mono-port en prod locale : le backend sert l'API et la PWA sur `http://localhost:3000`.
- SQLite (WAL + clés étrangères). Migration vers Postgres possible plus tard.
- TypeScript strict, `npm run build` et `npm run typecheck` verts, `npm audit` propre.
