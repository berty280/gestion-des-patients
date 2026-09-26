# CLAUDE.md — Contexte projet pour Claude & développeurs

> Ce fichier est lu automatiquement par Claude Code. Il résume l'architecture, les
> commandes et les conventions du projet **Clinique**. Voir aussi
> [`docs/SPEC.md`](docs/SPEC.md) (spécification) et
> [`docs/GUIDE_TEST.md`](docs/GUIDE_TEST.md) (installation/test).

## Vue d'ensemble
**Clinique** : logiciel de gestion des patients pour un centre de santé (Yaoundé,
contexte camerounais), **multi-postes** en réseau local. Modules : dossiers patients,
consultations **générales** et **spécialisées**, prescriptions (médicaments + examens),
références généraliste → spécialiste avec prise de rendez-vous, catalogue de
pathologies **CIM-10 / OMS** par spécialité, calendrier des spécialistes, file d'attente,
facturation (FCFA), rapports.

## Stack
- **Monorepo npm workspaces** : `backend/` + `frontend/`.
- **Backend** : Node + Fastify + TypeScript, SQLite via `better-sqlite3`. Auth JWT,
  validation `zod`, sert la PWA compilée via `@fastify/static` (mono-port).
- **Frontend** : React 18 + Vite 6 + TypeScript + Tailwind v4, PWA, `react-router-dom` v7.
- **Node ≥ 20**. Serveur en écoute sur `HOST=0.0.0.0` → accessible depuis les autres postes.

## Commandes (à la racine)
```bash
npm install
npm run dev:backend    # API dev (:3000)
npm run dev:frontend   # PWA dev (:5173, proxy /api -> :3000)
npm run build          # build backend (tsc) + frontend (vite)
npm run typecheck      # typecheck des 2 workspaces
npm run serve          # build + mono-port sur :3000
npm start              # backend compilé (API + PWA) sur :3000
npm run db:migrate | db:seed | db:reset
```

## Rôles & permissions
`ACCUEIL`, `GENERALISTE`, `SPECIALISTE` (avec `specialty`), `ADMIN`.
Rangs : ACCUEIL(1) < GENERALISTE(2) = SPECIALISTE(2) < ADMIN(3). Généraliste et
spécialiste sont au même niveau (`isMedecin`). Gardé côté API (`requireRole`,
`requireMedecin`) **et** UI (`components/Guards.tsx`).
- Patients (créer/éditer), file d'attente, facturation : Accueil+ (facturation : Accueil/Admin).
- Consultations & dossier médical (`/patients/:id/record`), pathologies (lecture),
  références : **personnel médical** (généraliste, spécialiste, admin).
- Consultation **générale** : généraliste/admin. Consultation **spécialisée** :
  spécialiste/admin (spécialité = celle du compte).
- Catalogue pathologies (écriture), calendriers de tous, utilisateurs, rapports,
  suppression patient/facture : **Admin**. Un spécialiste gère son propre calendrier.

## Modèle de données (voir `docs/SPEC.md` et `migrations/001_init.sql`)
Tables : `users` (+`specialty`), `patients`, `pathologies` (catalogue CIM-10 par
spécialité ou `GENERAL`), `consultations` (type `GENERALE|SPECIALISTE`, signes vitaux,
`findings`, `procedures`, `diagnosis`, `summary`, `referral_id`),
`consultation_pathologies`, `prescriptions`, `exam_orders` (`LABORATOIRE|IMAGERIE`),
`referrals` (généraliste → spécialité/spécialiste, `appointment_id`, statut),
`specialist_schedules` (jour de semaine 0–6 + horaires), `appointments`
(+`assigned_user_id`, `specialty`, `referral_id`), `invoices`/`invoice_items`/`payments`.
- Numéros lisibles : `patients.code` `P-00001`, `invoices.code` `F-00001`.
- Montants FCFA entiers ; statut de facture **dérivé** (items vs paiements).
- Données de démo (`db/seed.ts`) : 2 généralistes, 5 spécialistes, calendriers,
  102 pathologies CIM-10, patients + consultation + référence + RDV + facture.
- Catalogue CIM-10 = jeu **curé et extensible** (`db/pathologies.data.ts`), pas exhaustif.

## Backend (`backend/src/`)
- `config.ts` (`.env`), `server.ts` (routes sous `/api`, sert `frontend/dist`),
  `index.ts` (migrations au boot).
- `auth/` : JWT (payload inclut `specialty`), décorateurs `authenticate`,
  `requireRole`, `requireMedecin`.
- `routes/` : `patients` (dont `identify`, `:id/record`), `consultations`,
  `appointments`, `referrals`, `pathologies`, `schedules`, `specialties`
  (dont `/specialists`), `invoices`, `users`, `reports`, `backups`.
- `services/backup.ts` : sauvegarde SQLite (`db.backup()`, rotation, planificateur
  démarré au boot depuis `index.ts`). Config `backup.*` (`.env` `BACKUP_*`).
- `services/settings.ts` : identité du centre (nom/adresse/téléphone/logo) en table
  `settings` avec repli `.env` (`CLINIC_NAME/ADDRESS/PHONE`). Exposée via `GET /config`
  (public) ; modifiée via `GET/PATCH /settings` (admin, route `routes/settings.ts`).
- `lib/` : `errors`, `roles` (rangs + `SPECIALTIES`/`specialtyLabel`), `validate`.

## Frontend (`frontend/src/`)
- `lib/` : `api`, `types`, `roles`, `format` (FCFA, dates, spécialités, jours), `useFetch`.
- `components/` : `Layout` (nav selon le rôle), `Guards`, `PatientPicker`,
  `PathologyPicker`, `Modal`, `Toast`, `ui`, `Printables` (ordonnance / demande
  d'examens / reçu, impression navigateur isolée via `.print-document`).
- `lib/useClinic.ts` : nom du centre (depuis `/config`) pour l'en-tête des documents.
- `pages/` : `Login`, `Dashboard`, `Patients`(+`PatientDetail`,`PatientFormModal`),
  `Appointments` (file d'attente / agenda spécialiste), `Consultations`,
  `ConsultationFormModal`/`ConsultationView`, `Referrals`/`ReferralModal`,
  `Pathologies`, `Schedules`, `Invoices`(+modales), `Reports`, `Users`, `Backups`, `Settings`.

## Conventions & garde-fous
- TS strict ; `npm run typecheck` **et** `npm run build` doivent passer ; `npm audit` propre.
- Ne jamais committer : `node_modules/`, `dist/`, `backend/data/`, `.env`.
- Nouvelle table/colonne = nouvelle migration `NNN_*.sql` (ne pas éditer une migration
  déjà livrée en production ; ici le schéma est encore en pré-version).
- Énums et libellés métier en français.

## Pistes d'amélioration (hors périmètre actuel)
Résultats d'examens (saisie labo), rappels SMS de RDV, statistiques par spécialiste,
HTTPS, multi-centres. (Faites : sauvegarde automatique ; impression ordonnances /
demandes d'examens / reçus via le navigateur.)
