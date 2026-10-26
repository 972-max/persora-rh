// Informations légales de l'éditeur de Persora.
// ⚠️ À compléter avant toute commercialisation : SIRET et adresse
// sont obligatoires dans les mentions légales (loi pour la confiance
// dans l'économie numérique, art. 6).

export const PRIVACY_NOTICE_VERSION = '2026-10-26';

export const EDITOR = {
  name: 'Nathan Babootarie',
  status: 'Entrepreneur individuel (micro-entreprise)',
  siret: null as string | null, // ex. '123 456 789 00012'
  address: null as string | null, // adresse professionnelle ou de domiciliation
  email: 'babootarienathan@gmail.com',
  publicationDirector: 'Nathan Babootarie',
};

export const HOSTS = [
  {
    role: "Hébergement de l'application web",
    name: 'Vercel Inc.',
    address: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
  },
  {
    role: 'Hébergement de la base de données et des CV',
    name: 'Supabase Inc.',
    address: "970 Toa Payoh North #07-04, Singapour 318992 — serveurs situés à Paris (Union européenne)",
  },
];

export const MISSING = '[à compléter]';
