# Clinique — Spécification

Gestion des patients d'un centre de santé (Yaoundé). Application web **multi-postes**
(un poste serveur, les autres via le réseau local), en français, montants en **FCFA**.

## 1. Objectifs
1. **Dossier patient** unique, identifiable par **nom + date de naissance** ou par
   **téléphone** (détection des doublons à la saisie).
2. **Consultations générales** (plusieurs médecins généralistes) : signes vitaux
   (température, poids, taille, tension), symptômes, pathologies (CIM-10), prescription
   de médicaments, prescription d'examens (labo / imagerie), résumé de fin de séance.
3. **Référence** vers un spécialiste du centre, avec prise de **rendez-vous** selon le
   **calendrier de prestation** du spécialiste, et transmission des indications.
4. **Consultations spécialisées** (kiné, ophtalmo, dermato, gynéco, radiologue) : chaque
   spécialiste a sa **session**, sa **file de références**, son **catalogue de pathologies
   CIM-10** propre, et enregistre ses actes/thérapies, constatations, interprétation
   (radiologue), prescriptions.
5. **Dossier numérique unifié** regroupant toutes les consultations (générales +
   spécialisées), les médicaments et examens prescrits, les références.

## 2. Rôles & permissions
Rangs : `ACCUEIL` (1) < `GENERALISTE` (2) = `SPECIALISTE` (2) < `ADMIN` (3).

| Fonction                                        | Accueil | Généraliste | Spécialiste | Admin |
|-------------------------------------------------|:------:|:-----------:|:-----------:|:-----:|
| Créer / éditer un patient, file d'attente       |   ✔    |     ✔       |     ✔       |   ✔   |
| Facturation & encaissements                     |   ✔    |             |             |   ✔   |
| Dossier médical & consultations (lecture)       |        |     ✔       |     ✔       |   ✔   |
| Consultation générale                           |        |     ✔       |             |   ✔   |
| Consultation spécialisée (sa spécialité)        |        |             |     ✔       |   ✔   |
| Référer à un spécialiste                        |        |     ✔       |             |   ✔   |
| Catalogue pathologies (lecture)                 |        |     ✔       |     ✔       |   ✔   |
| Son propre calendrier                           |        |             |     ✔       |   ✔   |
| Catalogue (écriture), calendriers de tous,      |        |             |             |   ✔   |
| utilisateurs, rapports, suppression             |        |             |             |   ✔   |

Le tableau de bord est accessible à tous (indicateurs adaptés au rôle).
Confidentialité médicale : le contenu clinique n'est visible que du personnel médical.

## 3. Spécialités & pathologies
Spécialités : `KINE`, `OPHTALMOLOGIE`, `DERMATOLOGIE`, `GYNECOLOGIE`, `RADIOLOGIE`.
Chaque spécialité (et la médecine générale) dispose d'un **catalogue de pathologies**
avec **code CIM-10** et libellé français (`backend/src/db/pathologies.data.ts`).
Jeu de départ curé et **extensible par l'admin** (≈ 15–20 par spécialité) ; ce n'est
pas la base OMS exhaustive.

## 4. Modèle de données
Voir `backend/src/db/migrations/001_init.sql`. Tables principales :
- `users` (rôle + `specialty`), `patients` (`code` `P-00001`).
- `pathologies` (`specialty` | `GENERAL`, `code` CIM-10, `label`).
- `consultations` (`type` `GENERALE|SPECIALISTE`, `specialty`, `referral_id`, signes
  vitaux, `findings`, `procedures`, `diagnosis`, `summary`, `notes`), avec
  `consultation_pathologies`, `prescriptions`, `exam_orders` (`LABORATOIRE|IMAGERIE`).
- `referrals` (patient, `from_user_id`, `to_specialty`, `to_user_id?`, `appointment_id?`,
  `indications`, statut `EN_ATTENTE|PLANIFIE|TERMINE|ANNULE`).
- `specialist_schedules` (`weekday` 0–6, horaires).
- `appointments` (`assigned_user_id?`, `specialty?`, `referral_id?`, statut).
- `invoices` / `invoice_items` / `payments` (FCFA ; statut dérivé).

## 5. API (préfixe `/api`)
- Auth : `POST /auth/login`, `GET /auth/me`.
- Patients : `GET/POST /patients`, `GET /patients/identify`, `GET/PATCH /patients/:id`,
  `GET /patients/:id/record` (dossier complet, médical), `DELETE /patients/:id` (admin).
- Consultations : `GET/POST /consultations`, `GET /consultations/:id` (médical).
- Références : `GET/POST /referrals`, `PATCH /referrals/:id` (`?mine=1` pour le spécialiste).
- Rendez-vous : `GET/POST /appointments`, `PATCH/DELETE /appointments/:id`
  (`?scope=general|mine`, `?date=`, `?assigned_user_id=`).
- Pathologies : `GET /pathologies` (médical), `POST/PATCH/DELETE` (admin).
- Spécialités : `GET /specialties`, `GET /specialists?specialty=`.
- Calendriers : `GET /schedules`, `POST /schedules`, `DELETE /schedules/:id`.
- Facturation : `GET/POST /invoices`, `GET /invoices/:id`, `POST /invoices/:id/payments`,
  `DELETE /invoices/:id` (admin).
- Utilisateurs : `GET/POST/PATCH /users` (admin).
- Rapports : `GET /reports/dashboard` (tous), `GET /reports/activity?date=` (admin).
- Sauvegardes : `GET /backups`, `POST /backups`, `GET /backups/:name/download` (admin).

## 7. Sauvegarde
Sauvegarde automatique de la base SQLite (copie cohérente via `db.backup()`) au démarrage
puis à intervalle régulier (24 h par défaut), avec rotation. Réglages `.env` `BACKUP_*` ;
`BACKUP_DIR` peut pointer vers un disque externe. L'admin peut sauvegarder à la demande et
télécharger une sauvegarde depuis l'écran **Sauvegardes**.

## 6. Contraintes techniques
- Mono-port en prod locale (API + PWA sur `:3000`), écoute `0.0.0.0` pour l'accès réseau.
- SQLite (WAL + FK). Validation du calendrier : un RDV assigné doit tomber un jour de
  prestation du spécialiste.
- TypeScript strict ; `npm run build`/`typecheck` verts ; `npm audit` propre.
