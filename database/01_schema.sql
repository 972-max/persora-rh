-- Persora — schéma RH (sourcing nominatif, Crono Sécurité)
-- Appliqué réellement sur le projet Supabase persora-crono-securite (eu-west-1)

create extension if not exists "pgcrypto";

create table staff_users (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(150) not null,
  email varchar(180) not null unique,
  role varchar(20) not null check (role in ('admin', 'recruiter', 'readonly')),
  created_at timestamptz not null default now()
);

create table sourcing_sources (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null,
  platform_type varchar(60) not null,
  url_pattern varchar(255) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table sourcing_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sourcing_sources(id) on delete cascade,
  status varchar(20) not null check (status in ('queued','running','success','failed')),
  candidates_found integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz
);
create index idx_sourcing_jobs_status on sourcing_jobs(status);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(150) not null,
  contact_email varchar(180),
  source_id uuid references sourcing_sources(id),
  source_url varchar(500),
  experience_years numeric(4,1),
  availability varchar(60),
  savoir_etre_score numeric(3,2),
  status varchar(20) not null default 'new' check (status in ('new','contacted','qualified','interview_1','interview_2','rejected','hired')),
  consent_status varchar(20) not null default 'pending' check (consent_status in ('pending','informed','opted_out')),
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_candidates_status on candidates(status);
create index idx_candidates_consent on candidates(consent_status);

create table certifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  certification_type varchar(40) not null check (certification_type in ('carte_professionnelle','ssiap','sst','autre')),
  expiry_date date,
  is_verified boolean not null default false
);
create index idx_certifications_candidate on certifications(candidate_id);

create table consent_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  event_type varchar(20) not null check (event_type in ('informed','opted_out','opted_in')),
  channel varchar(40),
  created_at timestamptz not null default now()
);
create index idx_consent_events_candidate on consent_events(candidate_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid references staff_users(id),
  action varchar(80) not null,
  target_type varchar(50) not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

alter table candidates enable row level security;
alter table certifications enable row level security;
alter table consent_events enable row level security;
alter table staff_users enable row level security;
alter table audit_logs enable row level security;

create policy "Staff authentifié peut lire les candidats"
  on candidates for select using (auth.role() = 'authenticated');
create policy "Staff authentifié peut lire les certifications"
  on certifications for select using (auth.role() = 'authenticated');
create policy "Staff authentifié peut lire son propre profil"
  on staff_users for select using (auth.role() = 'authenticated');
