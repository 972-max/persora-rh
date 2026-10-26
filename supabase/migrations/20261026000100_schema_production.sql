-- Persora — schéma de production multi-entreprises
-- Chaque entreprise cliente (organization) ne voit que ses propres données.
-- Les candidats arrivent uniquement par candidature volontaire (page publique)
-- ou par import de candidatures déjà reçues par l'entreprise. Aucune collecte
-- automatique de profils sur des plateformes tierces.

create extension if not exists pgcrypto;

-- Fonctions internes, hors du schéma exposé par l'API
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 2 and 150),
  legal_name text,
  address text,
  privacy_contact_email text,
  is_accepting_applications boolean not null default false,
  -- Conservation d'un profil avec accord du candidat pour le vivier (en mois)
  retention_months integer not null default 24 check (retention_months between 1 and 36),
  -- Conservation sans accord pour le vivier : le temps du recrutement en cours
  retention_months_no_consent integer not null default 6 check (retention_months_no_consent between 1 and 12),
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('admin', 'recruiter', 'readonly')),
  full_name text not null check (char_length(full_name) between 2 and 150),
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);
create index idx_memberships_org on public.memberships(organization_id);

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 150),
  location text,
  contract_type text,
  description text check (char_length(description) <= 5000),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_job_offers_org on public.job_offers(organization_id);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_offer_id uuid references public.job_offers(id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 150),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 180),
  phone text check (char_length(phone) <= 30),
  city text check (char_length(city) <= 100),
  experience_years numeric(4,1) check (experience_years between 0 and 60),
  availability text check (availability in ('immediate', 'sous_preavis', 'a_convenir')),
  message text check (char_length(message) <= 2000),
  cv_path text unique,
  source text not null default 'candidature_directe'
    check (source in ('candidature_directe', 'import_rh')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'interview_1', 'interview_2', 'rejected', 'hired')),
  vivier_consent boolean not null default false,
  privacy_notice_version text not null,
  internal_notes text check (char_length(internal_notes) <= 5000),
  applied_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  retention_until timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_candidates_org_email on public.candidates(organization_id, lower(email));
create index idx_candidates_org_status on public.candidates(organization_id, status);
create index idx_candidates_retention on public.candidates(retention_until);
create index idx_candidates_offer on public.candidates(job_offer_id);

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  certification_type text not null
    check (certification_type in ('carte_professionnelle', 'ssiap1', 'ssiap2', 'ssiap3', 'sst', 'h0b0', 'autre')),
  expiry_date date,
  declared_by text not null default 'candidat' check (declared_by in ('candidat', 'recruteur')),
  is_verified boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz
);
create index idx_certifications_candidate on public.certifications(candidate_id);
create index idx_certifications_org on public.certifications(organization_id);
create index idx_certifications_verified_by on public.certifications(verified_by);

-- Historique RGPD. Survit à la suppression du candidat (sans donnée personnelle).
create table public.privacy_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null,
  event_type text not null check (event_type in (
    'application_received', 'application_updated', 'vivier_consent_given', 'vivier_consent_withdrawn',
    'candidate_deleted', 'retention_expired', 'data_request_handled')),
  actor text not null check (actor in ('candidat', 'recruteur', 'systeme')),
  detail text,
  created_at timestamptz not null default now()
);
create index idx_privacy_events_org on public.privacy_events(organization_id);
create index idx_privacy_events_candidate on public.privacy_events(candidate_id);

-- Demandes d'exercice des droits (accès, suppression, rectification, opposition)
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 180),
  request_type text not null check (request_type in ('acces', 'suppression', 'rectification', 'opposition')),
  message text check (char_length(message) <= 2000),
  status text not null default 'a_traiter' check (status in ('a_traiter', 'traitee', 'rejetee')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);
create index idx_data_requests_org on public.data_requests(organization_id, status);
create index idx_data_requests_handled_by on public.data_requests(handled_by);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_org on public.audit_logs(organization_id, created_at desc);
create index idx_audit_logs_user on public.audit_logs(user_id);

-- Fichiers de CV à effacer du stockage (traité par la fonction de maintenance)
create table private.storage_cleanup (
  path text primary key,
  queued_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fonctions d'appartenance (utilisées par les politiques RLS)
-- ---------------------------------------------------------------------------

create or replace function private.is_member(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  )
$$;

create or replace function private.member_role(org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.memberships m
  where m.organization_id = org and m.user_id = (select auth.uid())
$$;

create or replace function private.can_edit(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role(org) in ('admin', 'recruiter'), false)
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.is_member(uuid), private.member_role(uuid), private.can_edit(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Déclencheurs : dates, conservation, journal, file de suppression des CV
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_candidates_updated before update on public.candidates
  for each row execute function private.set_updated_at();
create trigger trg_job_offers_updated before update on public.job_offers
  for each row execute function private.set_updated_at();

-- Date limite de conservation : dernière activité + durée définie par l'entreprise
create or replace function private.compute_retention()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  months integer;
begin
  select case when new.vivier_consent then o.retention_months else o.retention_months_no_consent end
    into months
  from public.organizations o where o.id = new.organization_id;
  new.retention_until := new.last_activity_at + make_interval(months => months);
  return new;
end $$;

create trigger trg_candidates_retention
  before insert or update of last_activity_at, vivier_consent on public.candidates
  for each row execute function private.compute_retention();

-- Une suppression de candidat met son CV en file d'effacement et laisse une trace RGPD
create or replace function private.on_candidate_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.cv_path is not null then
    insert into private.storage_cleanup(path) values (old.cv_path) on conflict do nothing;
  end if;
  -- Entreprise supprimée en cascade : plus rien à journaliser
  if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  insert into public.privacy_events(organization_id, candidate_id, event_type, actor, detail)
  values (old.organization_id, null,
          case when current_setting('persora.retention_purge', true) = 'on' then 'retention_expired' else 'candidate_deleted' end,
          case when (select auth.uid()) is null then 'systeme' else 'recruteur' end,
          'Profil et CV supprimés');
  if (select auth.uid()) is not null then
    insert into public.audit_logs(organization_id, user_id, action, target_type, target_id)
    values (old.organization_id, (select auth.uid()), 'candidate.delete', 'candidate', old.id);
  end if;
  return old;
end $$;

create trigger trg_candidates_deleted after delete on public.candidates
  for each row execute function private.on_candidate_deleted();

-- Remplacement d'un CV : l'ancien fichier est mis en file d'effacement
create or replace function private.on_cv_replaced()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.cv_path is not null and old.cv_path is distinct from new.cv_path then
    insert into private.storage_cleanup(path) values (old.cv_path) on conflict do nothing;
  end if;
  return new;
end $$;

create trigger trg_candidates_cv_replaced after update of cv_path on public.candidates
  for each row execute function private.on_cv_replaced();

-- Journal des changements de statut faits par l'équipe
create or replace function private.audit_candidate_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and old.status is distinct from new.status then
    insert into public.audit_logs(organization_id, user_id, action, target_type, target_id)
    values (new.organization_id, (select auth.uid()), 'candidate.status:' || new.status, 'candidate', new.id);
  end if;
  return new;
end $$;

create trigger trg_candidates_audit after update on public.candidates
  for each row execute function private.audit_candidate_update();

-- Une certification doit appartenir à la même entreprise que son candidat
create or replace function private.check_certification_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.candidates c
                 where c.id = new.candidate_id and c.organization_id = new.organization_id) then
    raise exception 'Certification et candidat d''entreprises différentes';
  end if;
  return new;
end $$;

create trigger trg_certifications_org before insert or update on public.certifications
  for each row execute function private.check_certification_org();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.job_offers enable row level security;
alter table public.candidates enable row level security;
alter table public.certifications enable row level security;
alter table public.privacy_events enable row level security;
alter table public.data_requests enable row level security;
alter table public.audit_logs enable row level security;

-- Entreprises : visibles par leurs membres, modifiables par leurs admins
create policy "Membres lisent leur entreprise" on public.organizations
  for select to authenticated using ((select private.is_member(id)));
create policy "Admins modifient leur entreprise" on public.organizations
  for update to authenticated
  using ((select private.member_role(id)) = 'admin')
  with check ((select private.member_role(id)) = 'admin');

-- Équipe : visible par les membres ; un admin gère les autres membres (pas lui-même)
create policy "Membres voient leur équipe" on public.memberships
  for select to authenticated using ((select private.is_member(organization_id)));
create policy "Admins modifient les rôles" on public.memberships
  for update to authenticated
  using ((select private.member_role(organization_id)) = 'admin' and user_id <> (select auth.uid()))
  with check ((select private.member_role(organization_id)) = 'admin' and user_id <> (select auth.uid()));
create policy "Admins retirent un membre" on public.memberships
  for delete to authenticated
  using ((select private.member_role(organization_id)) = 'admin' and user_id <> (select auth.uid()));

-- Offres
create policy "Membres lisent les offres" on public.job_offers
  for select to authenticated using ((select private.is_member(organization_id)));
create policy "Équipe crée les offres" on public.job_offers
  for insert to authenticated with check ((select private.can_edit(organization_id)));
create policy "Équipe modifie les offres" on public.job_offers
  for update to authenticated
  using ((select private.can_edit(organization_id))) with check ((select private.can_edit(organization_id)));
create policy "Équipe supprime les offres" on public.job_offers
  for delete to authenticated using ((select private.can_edit(organization_id)));

-- Candidats
create policy "Membres lisent les candidats" on public.candidates
  for select to authenticated using ((select private.is_member(organization_id)));
create policy "Équipe importe des candidats" on public.candidates
  for insert to authenticated
  with check ((select private.can_edit(organization_id)) and source = 'import_rh');
create policy "Équipe modifie les candidats" on public.candidates
  for update to authenticated
  using ((select private.can_edit(organization_id))) with check ((select private.can_edit(organization_id)));
create policy "Équipe supprime les candidats" on public.candidates
  for delete to authenticated using ((select private.can_edit(organization_id)));

-- Certifications
create policy "Membres lisent les certifications" on public.certifications
  for select to authenticated using ((select private.is_member(organization_id)));
create policy "Équipe ajoute des certifications" on public.certifications
  for insert to authenticated with check ((select private.can_edit(organization_id)));
create policy "Équipe modifie les certifications" on public.certifications
  for update to authenticated
  using ((select private.can_edit(organization_id))) with check ((select private.can_edit(organization_id)));
create policy "Équipe supprime les certifications" on public.certifications
  for delete to authenticated using ((select private.can_edit(organization_id)));

-- Historique RGPD : lecture par les membres, ajout par l'équipe, jamais modifié
create policy "Membres lisent l'historique RGPD" on public.privacy_events
  for select to authenticated using ((select private.is_member(organization_id)));
create policy "Équipe ajoute à l'historique RGPD" on public.privacy_events
  for insert to authenticated
  with check ((select private.can_edit(organization_id)) and actor = 'recruteur');

-- Demandes de droits : créées par les candidats via une fonction, traitées par l'équipe
create policy "Membres lisent les demandes" on public.data_requests
  for select to authenticated using ((select private.is_member(organization_id)));
create policy "Équipe traite les demandes" on public.data_requests
  for update to authenticated
  using ((select private.can_edit(organization_id))) with check ((select private.can_edit(organization_id)));

-- Journal : admins seulement, en lecture
create policy "Admins lisent le journal" on public.audit_logs
  for select to authenticated using ((select private.member_role(organization_id)) = 'admin');

-- Les visiteurs non connectés n'accèdent à aucune table directement
revoke all on all tables in schema public from anon;
