# Guide d'installation & de test — Clinique

## Prérequis
- **Node.js ≥ 20** (`node -v`). Sous Windows : version LTS depuis <https://nodejs.org>.

## Installation (développement)
```bash
npm install
cp backend/.env.example backend/.env   # (Windows : copier le fichier à la main)
npm run db:reset            # base + comptes + catalogue CIM-10 + données de démo
```

## Lancer en développement (2 terminaux)
```bash
npm run dev:backend         # API sur http://localhost:3000
npm run dev:frontend        # PWA sur http://localhost:5173 (proxy /api -> 3000)
```

## Lancer « comme en production » (un seul port)
```bash
npm run serve               # build + serveur sur http://localhost:3000
```

## Multi-postes (réseau local)
Le serveur écoute sur toutes les interfaces (`HOST=0.0.0.0`). Depuis un autre poste du
même réseau, ouvrir `http://ADRESSE-IP-DU-SERVEUR:3000`. Le lanceur
`Clinique - Demarrer.bat` affiche cette adresse. Autoriser Node.js dans le pare-feu
Windows au premier lancement.

## Comptes de démonstration (mot de passe `clinique123`)
- `accueil@clinique.local` — Accueil
- `generaliste@clinique.local`, `generaliste2@clinique.local` — Généralistes
- `kine@`, `ophtalmo@`, `dermato@`, `gyneco@`, `radiologue@clinique.local` — Spécialistes
- `admin@clinique.local` — Administrateur

## Scénario de test complet
1. **Accueil** → **Patients** → *+ Nouveau patient*. Vérifier l'attribution du n° de
   dossier `P-0000x`. Rechercher un patient par nom, téléphone ou n° de dossier.
2. **Accueil** → **File d'attente** → *+ Rendez-vous* : mettre un patient en file.
3. **Généraliste** (`generaliste@`) → ouvrir un patient → *+ Consultation* :
   saisir signes vitaux, ajouter une **pathologie CIM-10**, un **médicament**, un
   **examen**, un **résumé**. Enregistrer.
4. Toujours en généraliste → sur le patient → **Référer** : choisir *Gynécologie*, le
   Dr Gynécologue, écrire des indications, fixer un rendez-vous. Astuce : la gynéco
   consulte **lundi et vendredi** — un autre jour est refusé (respect du calendrier).
5. **Gynécologue** (`gyneco@`) → **Mes références** : voir le patient référé avec les
   indications → *Consulter* : remplir constatations, diagnostic (pathologie gynéco
   CIM-10), traitement. À l'enregistrement, la référence passe **Terminée**.
6. **Généraliste / Gynéco** → ouvrir le patient : le **dossier unifié** montre les deux
   consultations (générale + gynéco), médicaments et examens prescrits, la référence.
7. **Radiologue** (`radiologue@`) : même principe, champ *Examen / interprétation*.
8. **Accueil** → **Facturation** → *+ Facture* → *Encaisser* un paiement (FCFA).
9. **Admin** → **Pathologies** : ajouter une pathologie à une spécialité. **Calendriers** :
   modifier les jours d'un spécialiste. **Utilisateurs** : créer un spécialiste (avec
   sa spécialité). **Rapports** : indicateurs du jour.
10. **Admin** → **Sauvegardes** : une sauvegarde est déjà créée au démarrage ;
    *Sauvegarder maintenant* en crée une, *Télécharger* récupère le fichier `.db`
    (à copier sur une clé USB). Vérifier aussi les fichiers dans `backend/data/backups/`.
11. **Admin** → **Paramètres** : saisir nom, adresse, téléphone et téléverser un logo.
    Vérifier qu'ils apparaissent ensuite sur l'écran de connexion et en en-tête des documents.
12. **Impression** : ouvrir une consultation avec médicaments → *Imprimer l'ordonnance*
    (et *Imprimer la demande d'examens* s'il y a des examens). Ouvrir une facture →
    *Imprimer le reçu*. L'aperçu n'affiche que le document (en-tête = identité du centre) ;
    utiliser la fenêtre d'impression du navigateur (ou « Enregistrer en PDF »).

## Vérifications développeur
```bash
npm run typecheck           # 0 erreur
npm run build               # backend + frontend compilent
```

## Réinitialiser les données de démo
```bash
npm run db:reset            # ⚠️ efface toutes les données puis re-seed
```
