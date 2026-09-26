# Guide d'installation & de test — Clinique

## Prérequis
- **Node.js ≥ 20** (tester avec `node -v`). Sous Windows, installer la version LTS
  depuis <https://nodejs.org>.

## Installation (développement)
```bash
npm install                 # installe backend + frontend
cp backend/.env.example backend/.env   # (Windows : copier le fichier à la main)
npm run db:reset            # crée la base + comptes + données de démonstration
```

## Lancer en développement (2 terminaux)
```bash
npm run dev:backend         # API sur http://localhost:3000
npm run dev:frontend        # PWA sur http://localhost:5173 (proxy /api -> 3000)
```
Ouvrir <http://localhost:5173>.

## Lancer en local « comme en production » (un seul port)
```bash
npm run serve               # build + démarre tout sur http://localhost:3000
```

## Comptes de démonstration
Mot de passe pour tous : `clinique123`
- `accueil@clinique.local` — rôle Accueil
- `soignant@clinique.local` — rôle Soignant
- `admin@clinique.local` — rôle Admin

## Scénario de test rapide
1. Se connecter en **Accueil** → **Patients** → *+ Nouveau patient* (nom, prénom,
   date de naissance…). Le n° de dossier `P-0000x` est attribué automatiquement.
2. **File d'attente** → *+ Rendez-vous* : choisir le patient, l'heure, cocher
   « Placer directement en file d'attente ». Faire avancer le statut
   (*Arrivé → En consultation → Terminer*).
3. Se connecter en **Soignant** → ouvrir le dossier du patient → *+ Consultation* :
   saisir signes vitaux, diagnostic, traitement. La consultation apparaît dans
   l'historique et dans l'onglet **Consultations**.
4. Se connecter en **Accueil** → **Facturation** → *+ Facture* : ajouter des lignes
   (consultation, médicaments). Ouvrir la facture → *Encaisser* un paiement.
   Le statut passe à *Partielle* puis *Payée*.
5. Se connecter en **Admin** → **Rapports** : voir les indicateurs du jour
   (nouveaux patients, consultations, recettes). **Utilisateurs** : créer un compte.

## Vérifications développeur
```bash
npm run typecheck           # 0 erreur
npm run build               # backend + frontend compilent
```

## Réinitialiser les données de démo
```bash
npm run db:reset            # ⚠️ efface toutes les données puis re-seed
```
