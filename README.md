# Clinique — Gestion des patients

Logiciel de **gestion des patients pour un centre de santé** (contexte camerounais,
interface en français, montants en **FCFA**). Application web locale installable
(PWA), pensée pour un poste unique au centre.

## Modules
- **Dossiers patients** — identité, âge, contact, groupe sanguin, allergies, antécédents.
- **Consultations** — motif, symptômes, signes vitaux (poids, taille, température,
  tension, pouls), diagnostic, traitement ; historique par patient.
- **File d'attente & rendez-vous** — planification et suivi du parcours du jour
  (*planifié → en attente → en consultation → terminé*).
- **Facturation & paiements** — factures multi-lignes, encaissements (espèces,
  Mobile Money…), suivi *impayée / partielle / payée*.
- **Tableau de bord** et **rapports d'activité** (réservés à l'administrateur).

## Stack
Monorepo npm (`backend/` + `frontend/`). Backend **Fastify + SQLite (better-sqlite3) +
TypeScript**, auth **JWT**. Frontend **React 18 + Vite + Tailwind v4**, PWA. En
production locale, un **seul port** sert l'API et l'interface : `http://localhost:3000`.

## Démarrage rapide (développeur)
```bash
npm install
cp backend/.env.example backend/.env
npm run db:reset      # base + comptes de démo + données d'exemple
npm run serve         # build + serveur sur http://localhost:3000
```
Comptes de démo (mot de passe `clinique123`) :
`accueil@clinique.local`, `soignant@clinique.local`, `admin@clinique.local`.

Voir [`docs/GUIDE_TEST.md`](docs/GUIDE_TEST.md) pour un scénario de test complet et
le mode développement (Vite sur :5173).

## Installation au centre de santé (Windows, sans ligne de commande)
1. Installer **Node.js LTS** depuis <https://nodejs.org> (une seule fois).
2. Double-cliquer sur **`Clinique - Installer (1 fois).bat`** (installe et prépare
   l'application + la base).
3. Double-cliquer sur **`Clinique - Demarrer.bat`** : le serveur démarre dans une
   petite fenêtre minimisée et le navigateur s'ouvre sur l'application.
4. Pour arrêter : **`Clinique - Arreter.bat`** (ou fermer la fenêtre du serveur).

> La fenêtre minimisée « Clinique (serveur) » doit rester ouverte pendant
> l'utilisation. Les données sont stockées localement dans `backend/data/`
> (à sauvegarder régulièrement — ce dossier n'est jamais versionné).

## Rôles
`ACCUEIL < SOIGNANT < ADMIN`. L'accueil gère patients, rendez-vous et facturation ;
le soignant ajoute les consultations (confidentielles) ; l'admin gère les
utilisateurs et les rapports. Détails dans [`docs/SPEC.md`](docs/SPEC.md).

## Sécurité (production)
- Changer `JWT_SECRET` et les mots de passe des comptes de démo dans `backend/.env`.
- Sauvegarder régulièrement `backend/data/clinique.db`.

## Commandes utiles
```bash
npm run dev:backend   # API en watch (:3000)
npm run dev:frontend  # PWA en dev (:5173)
npm run build         # build complet
npm run typecheck     # vérification TypeScript
npm run db:migrate    # applique les migrations
npm run db:seed       # (re)crée comptes + données de démo (idempotent)
npm run db:reset      # ⚠️ efface tout puis re-seed (dev uniquement)
```
