-- Persora — candidature volontaire et maintenance RGPD
-- Les certifications déclarées remplacées lors d'une nouvelle candidature sont archivées
-- (masquées aux recruteurs, supprimées avec le profil).
-- La suppression des profils expirés est faite par la fonction serveur "maintenance".

alter table public.certifications add column superseded_at timestamptz;
alter policy "Membres lisent les certifications" on public.certifications
  using ((select private.is_member(organization_id)) and superseded_at is null);

alter table private.storage_cleanup add column processed_at timestamptz;

-- Suppression sans utilisateur connecté = purge automatique de fin de conservation
create or replace function private.on_candidate_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.cv_path is not null then
    insert into private.storage_cleanup(path) values (old.cv_path)
    on conflict (path) do update set processed_at = null;
  end if;
  if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  insert into public.privacy_events(organization_id, candidate_id, event_type, actor, detail)
  values (old.organization_id, null,
          case when (select auth.uid()) is null then 'retention_expired' else 'candidate_deleted' end,
          case when (select auth.uid()) is null then 'systeme' else 'recruteur' end,
          'Profil et CV supprimés');
  if (select auth.uid()) is not null then
    insert into public.audit_logs(organization_id, user_id, action, target_type, target_id)
    values (old.organization_id, (select auth.uid()), 'candidate.delete', 'candidate', old.id);
  end if;
  return old;
end $$;

create or replace function private.on_cv_replaced()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.cv_path is not null and old.cv_path is distinct from new.cv_path then
    insert into private.storage_cleanup(path) values (old.cv_path)
    on conflict (path) do update set processed_at = null;
  end if;
  return new;
end $$;

-- Candidature volontaire. Ne révèle jamais si l'adresse e-mail était déjà connue.
create or replace function public.submit_application(
  p_slug text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_experience_years numeric,
  p_availability text,
  p_message text,
  p_job_offer_id uuid,
  p_cv_path text,
  p_vivier_consent boolean,
  p_privacy_notice_version text,
  p_certifications jsonb
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org public.organizations;
  v_candidate_id uuid;
  v_previous_consent boolean;
  v_cert jsonb;
begin
  select * into v_org from public.organizations where slug = p_slug;
  if not found or not v_org.is_accepting_applications then
    raise exception 'Les candidatures ne sont pas ouvertes pour cette entreprise.' using errcode = 'P0001';
  end if;

  if p_privacy_notice_version is null or char_length(p_privacy_notice_version) = 0 then
    raise exception 'La politique de confidentialité doit être acceptée.' using errcode = 'P0001';
  end if;

  if p_job_offer_id is not null and not exists (
    select 1 from public.job_offers j
    where j.id = p_job_offer_id and j.organization_id = v_org.id and j.is_published
  ) then
    raise exception 'Offre introuvable.' using errcode = 'P0001';
  end if;

  if p_cv_path is not null then
    if p_cv_path !~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx)$'
       or not exists (select 1 from storage.objects s where s.bucket_id = 'cvs' and s.name = p_cv_path)
       or exists (select 1 from public.candidates c where c.cv_path = p_cv_path) then
      raise exception 'Le CV n''a pas pu être rattaché. Merci de le déposer à nouveau.' using errcode = 'P0001';
    end if;
  end if;

  select c.id, c.vivier_consent into v_candidate_id, v_previous_consent
  from public.candidates c
  where c.organization_id = v_org.id and lower(c.email) = lower(trim(p_email))
  for update;

  if v_candidate_id is null then
    insert into public.candidates (
      organization_id, job_offer_id, full_name, email, phone, city, experience_years,
      availability, message, cv_path, source, vivier_consent, privacy_notice_version
    ) values (
      v_org.id, p_job_offer_id, trim(p_full_name), lower(trim(p_email)), nullif(trim(p_phone), ''),
      nullif(trim(p_city), ''), p_experience_years, p_availability, nullif(trim(p_message), ''),
      p_cv_path, 'candidature_directe', coalesce(p_vivier_consent, false), p_privacy_notice_version
    )
    returning id into v_candidate_id;

    insert into public.privacy_events(organization_id, candidate_id, event_type, actor, detail)
    values (v_org.id, v_candidate_id, 'application_received', 'candidat',
            'Politique de confidentialité ' || p_privacy_notice_version);
    if coalesce(p_vivier_consent, false) then
      insert into public.privacy_events(organization_id, candidate_id, event_type, actor)
      values (v_org.id, v_candidate_id, 'vivier_consent_given', 'candidat');
    end if;
  else
    update public.candidates set
      job_offer_id = coalesce(p_job_offer_id, job_offer_id),
      full_name = trim(p_full_name),
      phone = nullif(trim(p_phone), ''),
      city = nullif(trim(p_city), ''),
      experience_years = p_experience_years,
      availability = p_availability,
      message = nullif(trim(p_message), ''),
      cv_path = coalesce(p_cv_path, cv_path),
      vivier_consent = coalesce(p_vivier_consent, false),
      privacy_notice_version = p_privacy_notice_version,
      last_activity_at = now()
    where id = v_candidate_id;

    insert into public.privacy_events(organization_id, candidate_id, event_type, actor, detail)
    values (v_org.id, v_candidate_id, 'application_updated', 'candidat',
            'Politique de confidentialité ' || p_privacy_notice_version);
    if coalesce(p_vivier_consent, false) <> v_previous_consent then
      insert into public.privacy_events(organization_id, candidate_id, event_type, actor)
      values (v_org.id, v_candidate_id,
              case when coalesce(p_vivier_consent, false) then 'vivier_consent_given' else 'vivier_consent_withdrawn' end,
              'candidat');
    end if;

    update public.certifications set superseded_at = now()
    where candidate_id = v_candidate_id and declared_by = 'candidat'
      and not is_verified and superseded_at is null;
  end if;

  for v_cert in select * from jsonb_array_elements(coalesce(p_certifications, '[]'::jsonb)) loop
    insert into public.certifications (organization_id, candidate_id, certification_type, expiry_date, declared_by)
    values (v_org.id, v_candidate_id, v_cert->>'type', nullif(v_cert->>'expiry_date', '')::date, 'candidat');
  end loop;
end $$;

revoke all on function public.submit_application(text, text, text, text, text, numeric, text, text, uuid, text, boolean, text, jsonb) from public;
grant execute on function public.submit_application(text, text, text, text, text, numeric, text, text, uuid, text, boolean, text, jsonb) to anon, authenticated;

-- Fichiers à effacer du stockage : CV des profils supprimés et dépôts jamais rattachés (24 h)
create or replace function public.storage_cleanup_queue()
returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_paths text[];
begin
  insert into private.storage_cleanup(path)
  select s.name from storage.objects s
  where s.bucket_id = 'cvs'
    and s.name like 'incoming/%'
    and s.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.candidates c where c.cv_path = s.name)
  on conflict (path) do nothing;

  select coalesce(array_agg(path), '{}') into v_paths
  from private.storage_cleanup where processed_at is null;
  return v_paths;
end $$;

create or replace function public.confirm_storage_cleanup(p_paths text[])
returns void
language sql security definer set search_path = '' as $$
  update private.storage_cleanup set processed_at = now() where path = any(p_paths)
$$;

revoke all on function public.storage_cleanup_queue() from public, anon, authenticated;
revoke all on function public.confirm_storage_cleanup(text[]) from public, anon, authenticated;
grant execute on function public.storage_cleanup_queue() to service_role;
grant execute on function public.confirm_storage_cleanup(text[]) to service_role;
