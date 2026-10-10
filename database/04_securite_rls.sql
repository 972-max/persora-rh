-- Persora — renforcement de la sécurité (Row Level Security)
-- Statut : préparé, pas encore appliqué sur la base Supabase.
-- 1. Active la RLS sur les tables de sourcing, jusqu'ici lisibles et modifiables
--    par n'importe qui disposant de la clé publique.
-- 2. Différencie les droits par rôle : admin et recruteur peuvent agir,
--    le compte "readonly" ne fait que lire.
-- 3. Ajoute les droits d'écriture dont l'application a besoin
--    (enregistrement du consentement RGPD, mise à jour du statut).
-- 4. Ajoute les index manquants sur les clés étrangères.

-- Fonction utilitaire : rôle de l'utilisateur connecté
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_users where id = (select auth.uid())
$$;

revoke all on function public.current_staff_role() from public, anon;
grant execute on function public.current_staff_role() to authenticated;

-- Tables de sourcing
alter table public.sourcing_sources enable row level security;
alter table public.sourcing_jobs enable row level security;

create policy "Staff lit les sources" on public.sourcing_sources
  for select to authenticated using (true);
create policy "Admin gère les sources" on public.sourcing_sources
  for all to authenticated
  using ((select public.current_staff_role()) = 'admin')
  with check ((select public.current_staff_role()) = 'admin');

create policy "Staff lit les collectes" on public.sourcing_jobs
  for select to authenticated using (true);

-- Politiques de lecture existantes : limitées au rôle authenticated et optimisées
drop policy "Staff authentifié peut lire les candidats" on public.candidates;
drop policy "Staff authentifié peut lire les certifications" on public.certifications;
drop policy "Staff authentifié peut lire son propre profil" on public.staff_users;

create policy "Staff lit les candidats" on public.candidates
  for select to authenticated using (true);
create policy "Staff lit les certifications" on public.certifications
  for select to authenticated using (true);
create policy "Chacun lit son propre profil" on public.staff_users
  for select to authenticated using (id = (select auth.uid()));

-- Écriture : admin et recruteur uniquement
create policy "Admin et recruteur modifient les candidats" on public.candidates
  for update to authenticated
  using ((select public.current_staff_role()) in ('admin', 'recruiter'))
  with check ((select public.current_staff_role()) in ('admin', 'recruiter'));

create policy "Staff lit l'historique de consentement" on public.consent_events
  for select to authenticated using (true);
create policy "Admin et recruteur enregistrent un consentement" on public.consent_events
  for insert to authenticated
  with check ((select public.current_staff_role()) in ('admin', 'recruiter'));

create policy "Admin lit le journal" on public.audit_logs
  for select to authenticated
  using ((select public.current_staff_role()) = 'admin');

-- Index sur les clés étrangères
create index if not exists idx_audit_logs_staff_user on public.audit_logs(staff_user_id);
create index if not exists idx_candidates_source on public.candidates(source_id);
create index if not exists idx_sourcing_jobs_source on public.sourcing_jobs(source_id);
