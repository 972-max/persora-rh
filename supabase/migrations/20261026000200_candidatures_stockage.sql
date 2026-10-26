-- Persora — stockage des CV, page publique, demandes de droits

-- ---------------------------------------------------------------------------
-- Stockage des CV : privé, 5 Mo maximum, PDF ou Word
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- Dépôt : uniquement dans incoming/, sous un nom aléatoire, sans écrasement possible
create policy "Dépôt de CV" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'cvs'
    and name ~ '^incoming/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|docx)$'
  );

-- Lecture : seulement les membres de l'entreprise à laquelle le CV est rattaché
create policy "Membres lisent les CV de leurs candidats" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and exists (
      select 1 from public.candidates c
      where c.cv_path = storage.objects.name
        and (select private.is_member(c.organization_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Page publique d'une entreprise
-- ---------------------------------------------------------------------------

create or replace function public.get_public_organization(p_slug text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id,
    'slug', o.slug,
    'name', o.name,
    'legal_name', o.legal_name,
    'address', o.address,
    'privacy_contact_email', o.privacy_contact_email,
    'is_accepting_applications', o.is_accepting_applications,
    'retention_months', o.retention_months,
    'retention_months_no_consent', o.retention_months_no_consent,
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'title', j.title, 'location', j.location,
        'contract_type', j.contract_type, 'description', j.description
      ) order by j.created_at desc)
      from public.job_offers j
      where j.organization_id = o.id and j.is_published
    ), '[]'::jsonb)
  )
  from public.organizations o
  where o.slug = p_slug
$$;

revoke all on function public.get_public_organization(text) from public;
grant execute on function public.get_public_organization(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Demande d'exercice des droits RGPD
-- ---------------------------------------------------------------------------

create or replace function public.request_data_rights(
  p_slug text, p_email text, p_request_type text, p_message text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.organizations where slug = p_slug;
  if v_org_id is null then
    raise exception 'Entreprise introuvable.' using errcode = 'P0001';
  end if;
  -- Limite anti-abus : 5 demandes par adresse et par jour
  if (select count(*) from public.data_requests d
      where d.organization_id = v_org_id and lower(d.email) = lower(trim(p_email))
        and d.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de demandes envoyées aujourd''hui. Réessayez demain.' using errcode = 'P0001';
  end if;
  insert into public.data_requests(organization_id, email, request_type, message)
  values (v_org_id, lower(trim(p_email)), p_request_type, nullif(trim(p_message), ''));
end $$;

revoke all on function public.request_data_rights(text, text, text, text) from public;
grant execute on function public.request_data_rights(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Premier changement de mot de passe effectué
-- ---------------------------------------------------------------------------

create or replace function public.mark_password_changed()
returns void
language sql security definer set search_path = '' as $$
  update public.memberships set must_change_password = false where user_id = (select auth.uid())
$$;

revoke all on function public.mark_password_changed() from public, anon;
grant execute on function public.mark_password_changed() to authenticated;

-- Retrouver un compte existant lors d'une invitation
create or replace function public.find_auth_user_id(p_email text)
returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

revoke all on function public.find_auth_user_id(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id(text) to service_role;
