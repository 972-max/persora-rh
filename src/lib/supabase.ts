import { createClient } from '@supabase/supabase-js';

// Ces valeurs sont volontairement codées en dur ici : la clé "publishable"
// Supabase est conçue pour être exposée côté client (équivalent d'une clé
// publique), la sécurité réelle est assurée par les politiques RLS définies
// en base (voir migration init_schema_sourcing_rh).
const SUPABASE_URL = 'https://motuetyractuxkljqtlk.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_z21L4Hbb_Ct2hPoUais52w_PgYkL1qL';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type CandidateStatus =
  | 'new' | 'contacted' | 'qualified' | 'interview_1' | 'interview_2' | 'rejected' | 'hired';

export type ConsentStatus = 'pending' | 'informed' | 'opted_out';

export interface Certification {
  id: string;
  certification_type: string;
  expiry_date: string | null;
  is_verified: boolean;
}

export interface Candidate {
  id: string;
  full_name: string;
  contact_email: string | null;
  experience_years: number | null;
  availability: string | null;
  savoir_etre_score: number | null;
  status: CandidateStatus;
  consent_status: ConsentStatus;
  discovered_at: string;
  certifications?: Certification[];
}

export type StaffRole = 'admin' | 'recruiter' | 'readonly';

export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Responsable RH',
  recruiter: 'Chargé de recrutement',
  readonly: 'Lecture seule',
};

export const CONSENT_LABELS: Record<ConsentStatus, string> = {
  pending: 'En attente',
  informed: 'Informé',
  opted_out: "S'est opposé",
};

// Rôle de l'utilisateur connecté, lu dans staff_users.
// La politique RLS "Chacun lit son propre profil" ne renvoie que sa propre ligne.
export async function fetchMyRole(): Promise<StaffRole | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('staff_users').select('role').eq('id', auth.user.id).maybeSingle();
  return (data?.role as StaffRole) ?? null;
}

// Traduit les erreurs techniques de Supabase en messages compréhensibles.
export function friendlyError(raw: unknown): string {
  const msg = typeof raw === 'string' ? raw : (raw as { message?: string })?.message ?? '';
  if (/row-level security|permission denied|42501/i.test(msg)) {
    return "Action non autorisée pour votre rôle. Elle est réservée aux recruteurs et aux responsables RH.";
  }
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/i.test(msg)) return "Cette adresse e-mail n'est pas encore confirmée.";
  if (!msg || msg === '{}' || /fetch|network|timeout/i.test(msg)) {
    return 'Connexion au serveur impossible. La base de démonstration est peut-être en veille : réessayez dans une ou deux minutes.';
  }
  return msg;
}
