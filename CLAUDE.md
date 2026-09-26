# CLAUDE.md — Contexte projet pour Claude & développeurs

> Ce fichier est lu automatiquement par Claude Code. Il résume l'architecture, les
> commandes et les conventions du projet **Clinique**. Voir aussi
> [`docs/SPEC.md`](docs/SPEC.md) (spécification) et
> [`docs/GUIDE_TEST.md`](docs/GUIDE_TEST.md) (installation/test).

## Vue d'ensemble
**Clinique** : logiciel de gestion des patients pour un centre de santé (contexte
camerounais). MVP fonctionnel couvrant 4 modules : **dossiers patients**,
**consultations** (historique médical + signes vitaux), **file d'attente / rendez-vous**,
et **facturation / paiements** (montants en FCFA).

## Stack
- **Monorepo npm workspaces** : `backend/` + `frontend/`.
- **Backend** : Node + Fastify + TypeScript, SQLite via `better-sqlite3`.
  Auth JWT (`@fastify/jwt`), validation `zod`, sert aussi la PWA compilée via
  `@fastify/static` (mode mono-port).
- **Frontend** : React 18 + Vite 6 + TypeScript + Tailwind v4, PWA
  (`vite-plugin-pwa`), routage `react-router-dom` v7.
- **Node ≥ 20** requis.

## Commandes (à la racine)
```bash
npm install            # installe les 2 workspaces
npm run dev:backend    # API dev (tsx watch) sur :3000
npm run dev:frontend   # PWA dev (Vite) sur :5173, proxy /api -> :3000
npm run build          # build backend (tsc) + frontend (vite)
npm run typecheck      # typecheck des 2 workspaces
npm run serve          # build + démarre le mono-port sur :3000 (prod locale)
npm start              # démarre le backend compilé (sert API + PWA) sur :3000
npm run db:migrate     # applique les migrations SQL
npm run db:seed        # seed idempotent (3 comptes de rôles + données démo)
npm run db:reset       # DROP + migrate + seed (dev uniquement — efface les données)
```

## Architecture backend (`backend/src/`)
- `config.ts` : configuration via `.env` (port, DB, JWT, `CLINIC_NAME`, `FRONTEND_DIST`).
- `server.ts` : build Fastify ; **toutes les routes API sont sous le préfixe `/api`** ;
  sert `frontend/dist` avec fallback SPA quand le dossier existe (mono-port).
- `index.ts` : point d'entrée ; applique les migrations au boot puis écoute.
- `db/` : `connection.ts` (SQLite WAL + FK), `migrate.ts` (runner suivi dans
  `_migrations`), `migrations/*.sql`, `seed.ts`, `reset.ts`.
- `auth/` : `plugin.ts` (JWT + décorateurs `authenticate` / `requireRole`),
  `routes.ts` (`/auth/login`, `/auth/me`).
- `routes/` : `patients`, `consultations`, `appointments`, `invoices`, `users`, `reports`.
- `lib/` : `errors.ts` (helpers HTTP), `roles.ts` (hiérarchie des rôles), `validate.ts`
  (parse zod → 400).

## Modèle de données (voir `docs/SPEC.md`)
Tables : `users`, `patients`, `consultations`, `appointments`, `invoices`,
`invoice_items`, `payments` (+ `_migrations`).
- **Numéros de dossier** : `patients.code` (ex. `P-00001`), `invoices.code` (ex. `F-00001`),
  générés à partir de l'id après insertion.
- **Statut de facture dérivé** : calculé depuis `SUM(invoice_items)` vs `SUM(payments)`
  (`IMPAYEE|PARTIELLE|PAYEE`), jamais stocké.
- **Montants en FCFA** : entiers (pas de décimales).
- Valeurs d'énum en français : rôles `ACCUEIL|SOIGNANT|ADMIN`, statuts RDV
  `PLANIFIE|EN_ATTENTE|EN_COURS|TERMINE|ANNULE`, paiements
  `ESPECES|MOBILE_MONEY|CARTE|AUTRE`.

## Rôles & permissions
Hiérarchie `ACCUEIL < SOIGNANT < ADMIN` (`lib/roles.ts`).
- Patients (créer/éditer), rendez-vous / file d'attente, facturation & paiements : **tous** (Accueil+).
- Consultations (lire/créer — confidentialité médicale) : **Soignant+**.
- Suppression de patient/facture, Utilisateurs, Rapports détaillés : **Admin**.
- Le tableau de bord (`/reports/dashboard`) est accessible à tous.
Gardé côté API (`requireRole`) **et** côté UI (`components/Guards.tsx`).

## Frontend (`frontend/src/`)
- `lib/api.ts` : client `fetch` (préfixe `/api`, Bearer token, gestion 401).
- `lib/format.ts` : helpers FCFA, dates, âge, libellés de statuts.
- `auth/AuthContext.tsx` : session JWT (token en `localStorage`).
- `components/` : `Layout`, `Guards`, `PatientPicker`, `Modal`, `Toast`, `ui` (primitives).
- `pages/` : `Login`, `Dashboard`, `Patients` (+ `PatientDetail`, `PatientFormModal`),
  `Appointments` (file d'attente), `Consultations` (+ `ConsultationFormModal`,
  `ConsultationView`), `Invoices` (+ `InvoiceFormModal`, `InvoiceDetailModal`),
  `Reports`, `Users`.

## Comptes de démonstration (seed)
Mot de passe = `SEED_DEFAULT_PASSWORD` (défaut `clinique123`) :
`accueil@clinique.local`, `soignant@clinique.local`, `admin@clinique.local`.
⚠️ À changer en production.

## Déploiement centre de santé (Windows)
Lanceurs à double-clic à la racine (voir README) : `Clinique - Installer (1 fois)`,
`Clinique - Demarrer` (serveur en fenêtre minimisée + ouvre le navigateur),
`Clinique - Arreter`. En prod locale, **un seul port** : `http://localhost:3000`
(interface + API).

## Conventions & garde-fous
- Écrire du TS strict ; `npm run typecheck` **et** `npm run build` doivent passer.
- Garder `npm audit` propre (0 vulnérabilité).
- Ne jamais committer : `node_modules/`, `dist/`, `backend/data/` (base SQLite), `.env`
  (déjà dans `.gitignore`). La base de prod ne doit pas être écrasée par un déploiement.
- Toute nouvelle table/colonne = **nouvelle migration** `NNN_*.sql` (ne pas éditer une
  migration déjà appliquée).
- Les valeurs d'énum et libellés métier restent en français.

## Pistes d'amélioration (hors MVP)
Impression/PDF des reçus et ordonnances, sauvegarde auto de la base, HTTPS + accès
mobile, statistiques mensuelles/annuelles, gestion des lots de médicaments,
export CSV/PDF des rapports, rappels SMS de rendez-vous, multi-centres.
