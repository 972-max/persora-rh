import { createClient } from '@supabase/supabase-js';

// Configuration fournie par l'hébergeur (variables d'environnement Vercel).
// La clé "publishable" est conçue pour être exposée côté navigateur :
// la sécurité réelle repose sur les politiques Row Level Security en base.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Configuration Supabase manquante (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CandidateStatus =
  | 'new' | 'contacted' | 'qualified' | 'interview_1' | 'interview_2' | 'rejected' | 'hired';
export type Role = 'admin' | 'recruiter' | 'readonly';
export type Availability = 'immediate' | 'sous_preavis' | 'a_convenir';
export type CertificationType =
  | 'carte_professionnelle' | 'ssiap1' | 'ssiap2' | 'ssiap3' | 'sst' | 'h0b0' | 'autre';

export interface Organization {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  address: string | null;
  privacy_contact_email: string | null;
  is_accepting_applications: boolean;
  retention_months: number;
  retention_months_no_consent: number;
}

export interface PublicOffer {
  id: string;
  title: string;
  location: string | null;
  contract_type: string | null;
  description: string | null;
}

export interface PublicOrganization extends Organization {
  offers: PublicOffer[];
}

export interface Membership {
  user_id: string;
  organization_id: string;
  role: Role;
  full_name: string;
  must_change_password: boolean;
  organizations?: Organization;
}

export interface Certification {
  id: string;
  candidate_id: string;
  organization_id: string;
  certification_type: CertificationType;
  expiry_date: string | null;
  declared_by: 'candidat' | 'recruteur';
  is_verified: boolean;
  verified_at: string | null;
}

export interface Candidate {
  id: string;
  organization_id: string;
  job_offer_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  experience_years: number | null;
  availability: Availability | null;
  message: string | null;
  cv_path: string | null;
  source: 'candidature_directe' | 'import_rh';
  status: CandidateStatus;
  vivier_consent: boolean;
  privacy_notice_version: string;
  internal_notes: string | null;
  applied_at: string;
  last_activity_at: string;
  retention_until: string;
  certifications?: Certification[];
  job_offers?: { title: string } | null;
}

export interface JobOffer {
  id: string;
  organization_id: string;
  title: string;
  location: string | null;
  contract_type: string | null;
  description: string | null;
  is_published: boolean;
  created_at: string;
}

export interface PrivacyEvent {
  id: string;
  candidate_id: string | null;
  event_type: string;
  actor: 'candidat' | 'recruteur' | 'systeme';
  detail: string | null;
  created_at: string;
}

export interface DataRequest {
  id: string;
  organization_id: string;
  email: string;
  request_type: 'acces' | 'suppression' | 'rectification' | 'opposition';
  message: string | null;
  status: 'a_traiter' | 'traitee' | 'rejetee';
  created_at: string;
  handled_at: string | null;
}

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<CandidateStatus, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  interview_1: 'Entretien 1',
  interview_2: 'Entretien 2',
  rejected: 'Non retenu',
  hired: 'Recruté',
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Responsable RH',
  recruiter: 'Chargé de recrutement',
  readonly: 'Lecture seule',
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  immediate: 'Immédiate',
  sous_preavis: 'Sous préavis',
  a_convenir: 'À convenir',
};

export const CERTIFICATION_LABELS: Record<CertificationType, string> = {
  carte_professionnelle: 'Carte professionnelle (CNAPS)',
  ssiap1: 'SSIAP 1',
  ssiap2: 'SSIAP 2',
  ssiap3: 'SSIAP 3',
  sst: 'SST',
  h0b0: 'Habilitation électrique H0B0',
  autre: 'Autre',
};

export const CERTIFICATION_SHORT: Record<CertificationType, string> = {
  carte_professionnelle: 'Carte pro',
  ssiap1: 'SSIAP 1',
  ssiap2: 'SSIAP 2',
  ssiap3: 'SSIAP 3',
  sst: 'SST',
  h0b0: 'H0B0',
  autre: 'Autre',
};

export const PRIVACY_EVENT_LABELS: Record<string, string> = {
  application_received: 'Candidature reçue',
  application_updated: 'Candidature mise à jour',
  vivier_consent_given: 'Accord pour le vivier donné',
  vivier_consent_withdrawn: 'Accord pour le vivier retiré',
  candidate_deleted: 'Profil supprimé',
  retention_expired: 'Profil supprimé (durée de conservation atteinte)',
  data_request_handled: 'Demande RGPD traitée',
};

export const REQUEST_TYPE_LABELS: Record<DataRequest['request_type'], string> = {
  acces: 'Accès à mes données',
  suppression: 'Suppression de mes données',
  rectification: 'Rectification',
  opposition: 'Opposition',
};

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

export function friendlyError(raw: unknown): string {
  const msg = typeof raw === 'string' ? raw : (raw as { message?: string })?.message ?? '';
  if (/row-level security|permission denied|42501/i.test(msg)) {
    return 'Action non autorisée pour votre rôle.';
  }
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/i.test(msg)) return "Cette adresse e-mail n'est pas encore confirmée.";
  if (/password should be at least|weak password/i.test(msg)) {
    return 'Mot de passe trop faible : au moins 12 caractères.';
  }
  if (/new password should be different/i.test(msg)) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) {
    return 'Fichier trop volumineux (5 Mo maximum).';
  }
  if (/mime type|invalid_mime_type/i.test(msg)) return 'Format de fichier non accepté : PDF ou Word (.docx).';
  if (!msg || msg === '{}' || /failed to fetch|network|timeout/i.test(msg)) {
    return 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.';
  }
  return msg;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatYears(n: number | null): string {
  if (n == null) return '—';
  return `${Number(n).toLocaleString('fr-FR')} an${n >= 2 ? 's' : ''}`;
}

// Une certification expire dans moins de 60 jours, ou est déjà expirée
export function expiryState(date: string | null): 'ok' | 'soon' | 'expired' | 'unknown' {
  if (!date) return 'unknown';
  const days = (new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return 'expired';
  if (days < 60) return 'soon';
  return 'ok';
}

export function randomId(): string {
  return crypto.randomUUID();
}
