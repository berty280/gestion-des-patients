# Clinique — Gestion des patients

Logiciel de **gestion des patients pour un centre de santé** (contexte camerounais,
Yaoundé ; interface en français, montants en **FCFA**). Application web installable
(PWA), **multi-postes** sur le réseau local du centre.

## Modules
- **Dossiers patients** — identité, âge, contact, groupe sanguin, allergies, antécédents.
  Identification par **nom + date de naissance** ou par **numéro de téléphone**
  (avec détection des doublons).
- **Médecins généralistes** — plusieurs comptes ; chaque consultation : température,
  poids, taille, tension artérielle, symptômes, **pathologies (CIM-10 / OMS)**,
  **prescription de médicaments**, **prescription d'examens** (laboratoire / imagerie),
  **résumé de fin de séance**, et **référence à un spécialiste** avec prise de
  rendez-vous selon le calendrier du spécialiste.
- **Spécialistes** — sessions dédiées : kinésithérapeute, ophtalmologue, dermatologue,
  gynécologue, radiologue (échographies + interprétation). Chaque spécialiste voit
  les patients qui lui sont **référés** (avec les indications du généraliste), dispose
  d'un **catalogue de pathologies CIM-10 propre à sa spécialité**, et d'un **calendrier
  de prestation** (jours de présence au centre).
- **Dossier numérique unifié** — toutes les consultations (générales + spécialisées),
  les médicaments et les examens prescrits, les références, rattachés au même patient.
- **Impression** — ordonnance médicale, demande d'examens (depuis une consultation) et
  reçu de paiement (depuis une facture), avec en-tête du centre, prêts à imprimer.
- **File d'attente & rendez-vous**, **facturation & paiements**, **tableau de bord**
  et **rapports d'activité**.

## Rôles
`ACCUEIL`, `GENERALISTE`, `SPECIALISTE` (avec spécialité), `ADMIN`. Chaque personne a
son compte. Détails dans [`docs/SPEC.md`](docs/SPEC.md).

## Stack
Monorepo npm (`backend/` + `frontend/`). Backend **Fastify + SQLite (better-sqlite3) +
TypeScript**, auth **JWT**. Frontend **React 18 + Vite + Tailwind v4**, PWA.

## Démarrage rapide (développeur)
```bash
npm install
cp backend/.env.example backend/.env
npm run db:reset      # base + comptes de démo + catalogue CIM-10 + données d'exemple
npm run serve         # build + serveur sur http://localhost:3000
```

## Installation multi-postes au centre de santé (Windows)
Un **poste sert de serveur** ; les autres postes s'y connectent via le réseau local.

1. **Sur le poste serveur** : installer **Node.js LTS** (<https://nodejs.org>), puis
   double-cliquer sur **`Clinique - Installer (1 fois).bat`**.
2. Double-cliquer sur **`Clinique - Demarrer.bat`** : le serveur démarre et affiche
   l'**adresse réseau** à utiliser sur les autres postes (ex. `http://192.168.1.20:3000`).
3. **Sur les autres postes** (accueil, médecins, spécialistes) : ouvrir un navigateur
   (Chrome/Edge) à cette adresse `http://IP-DU-SERVEUR:3000` et se connecter avec son compte.
   On peut « Installer l'application » depuis le navigateur (PWA) pour un raccourci bureau.
4. Pour arrêter : **`Clinique - Arreter.bat`** sur le poste serveur.

> Pré-requis réseau : les postes doivent être sur le **même réseau** (Wi-Fi/filaire) et
> le **pare-feu Windows** du poste serveur doit autoriser Node.js sur le port 3000
> (Windows le demande au premier lancement — cliquer « Autoriser »).
> La base et les données restent **uniquement** sur le poste serveur (`backend/data/`) —
> à sauvegarder régulièrement. Ce dossier n'est jamais versionné.

## Comptes de démonstration
Mot de passe pour tous : `clinique123`
- `accueil@clinique.local` — Accueil
- `generaliste@clinique.local`, `generaliste2@clinique.local` — Médecins généralistes
- `kine@clinique.local`, `ophtalmo@clinique.local`, `dermato@clinique.local`,
  `gyneco@clinique.local`, `radiologue@clinique.local` — Spécialistes
- `admin@clinique.local` — Administrateur

Voir [`docs/GUIDE_TEST.md`](docs/GUIDE_TEST.md) pour un scénario de test complet.

## Sauvegarde des données
La base est sauvegardée **automatiquement** (copie cohérente, compatible avec la base en
cours d'utilisation) : au démarrage du serveur puis toutes les 24 h par défaut, avec
rotation (30 sauvegardes conservées). Réglages dans `backend/.env` (`BACKUP_ENABLED`,
`BACKUP_DIR`, `BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP`, `BACKUP_ON_START`).

- En **Administrateur**, l'écran **Sauvegardes** permet de sauvegarder à la demande et de
  **télécharger** une sauvegarde pour la mettre sur une **clé USB / disque externe**.
- Recommandé en production : pointer `BACKUP_DIR` vers un disque externe (ex.
  `BACKUP_DIR=E:/sauvegardes-clinique`) **et** conserver une copie hors du poste serveur.
- Restauration : arrêter le serveur, remplacer `backend/data/clinique.db` par le fichier de
  sauvegarde (renommé `clinique.db`), supprimer les éventuels `clinique.db-wal`/`-shm`,
  puis redémarrer.

## Sécurité (production)
- Changer `JWT_SECRET` et les mots de passe des comptes de démo dans `backend/.env`.
- Renseigner `CLINIC_NAME` dans `backend/.env`.
- Utiliser un onduleur sur le poste serveur (coupures de courant) et vérifier les sauvegardes.

## Commandes utiles
```bash
npm run dev:backend   # API en watch (:3000)
npm run dev:frontend  # PWA en dev (:5173)
npm run build         # build complet
npm run typecheck     # vérification TypeScript
npm run db:migrate    # applique les migrations
npm run db:seed       # comptes + catalogue + données de démo (idempotent)
npm run db:reset      # ⚠️ efface tout puis re-seed (dev uniquement)
```
