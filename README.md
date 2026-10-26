# Persora — recrutement des agents de sécurité privée

Logiciel de gestion des candidatures pour les sociétés de sécurité privée : page de candidature
à leur nom, suivi des certifications (carte professionnelle, SSIAP, SST) et de leurs dates
d'expiration, conformité RGPD intégrée. Une même installation sert plusieurs entreprises clientes,
chacune ne voyant que ses propres données.

**Stack** : React 18 · TypeScript · Vite · Supabase (PostgreSQL, Auth, Storage, Edge Functions, Row Level Security) · Vercel

> La version de démonstration (projet annuel du Bachelor Data & BI, NEXA Digital School) reste
> sur la branche `main`. Cette branche `production` contient la version commercialisable.

## Fonctionnement

| Qui | Où | Quoi |
|---|---|---|
| Candidat | `/postuler/:entreprise` | Dépose son CV, déclare ses certifications, accepte la politique de confidentialité, choisit ou non d'entrer dans le vivier |
| Candidat | `/mes-donnees/:entreprise` | Demande l'accès, la rectification, la suppression ou s'oppose |
| Recruteur | `/app` | Vivier filtrable, fiche candidat, vérification des certifications, statut, notes |
| Responsable RH | `/app/equipe`, `/app/entreprise` | Comptes de l'équipe, identité légale, durées de conservation, ouverture des candidatures |

## Choix de conformité

- **Aucune collecte automatique** de profils sur des plateformes tierces : les candidats postulent
  volontairement, ou l'équipe ajoute une candidature qu'elle a elle-même reçue.
- **Bases légales** : mesures précontractuelles pour la candidature, consentement pour le vivier.
- **Aucune décision automatisée** (article 22) : pas de score, pas de tri algorithmique.
- **Conservation** : durée paramétrable par entreprise (24 mois avec accord, 6 mois sans, par défaut).
  Une maintenance horaire (`pg_cron` → fonction `maintenance`) supprime les profils expirés et efface les CV.
- **Isolement** : chaque table est protégée par des politiques RLS fondées sur l'appartenance à l'entreprise ;
  les visiteurs non connectés n'ont accès qu'à trois fonctions contrôlées (page publique, candidature, demande de droits).
- **CV** : stockage privé, 5 Mo maximum, PDF ou Word, lisible uniquement par l'équipe de l'entreprise concernée,
  via des liens temporaires d'une minute.
- **Historique RGPD** et **journal des actions** conservés sans donnée personnelle après suppression d'un profil.

## Rôles

| Action | Lecture seule | Chargé de recrutement | Responsable RH |
|---|---|---|---|
| Consulter candidats, offres, demandes | ✓ | ✓ | ✓ |
| Modifier un candidat, vérifier une certification, supprimer un profil | ✗ | ✓ | ✓ |
| Gérer les offres, traiter une demande RGPD | ✗ | ✓ | ✓ |
| Gérer l'équipe et l'entreprise, lire le journal | ✗ | ✗ | ✓ |

## Structure

```
src/pages/public/      pages candidats (accueil, candidature, confidentialité, droits, mentions légales)
src/pages/app/         espace recruteur
supabase/migrations/   schéma, sécurité, fonctions (à appliquer dans l'ordre)
supabase/functions/    maintenance (purge RGPD), manage-member (comptes de l'équipe)
```

## Lancer en local

```bash
cp .env.example .env.local   # renseigner l'URL et la clé publique Supabase
npm install
npm run dev
```

## Avant la commercialisation

- Compléter `src/lib/legal.ts` : SIRET et adresse de l'éditeur.
- Signer avec chaque entreprise cliente un contrat de sous-traitance (article 28 du RGPD).
- Dans le tableau de bord Supabase : désactiver les inscriptions publiques (Authentication → Sign In / Providers).

---
Nathan Babootarie · [LinkedIn](https://linkedin.com/in/nathan-babootarie)
