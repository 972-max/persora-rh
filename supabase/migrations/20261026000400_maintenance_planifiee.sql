-- Persora — maintenance RGPD planifiée toutes les heures (pg_cron → fonction serveur "maintenance")
-- Le secret partagé est généré en base et n'est lisible que par la clé de service.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table private.app_config (
  key text primary key,
  value text not null
);

insert into private.app_config(key, value)
values ('maintenance_secret', encode(extensions.gen_random_bytes(32), 'hex'));

create or replace function public.maintenance_secret()
returns text
language sql stable security definer set search_path = '' as $$
  select value from private.app_config where key = 'maintenance_secret'
$$;

revoke all on function public.maintenance_secret() from public, anon, authenticated;
grant execute on function public.maintenance_secret() to service_role;

-- Remplacer l'identifiant du projet si la base est recréée ailleurs
select cron.schedule(
  'persora-maintenance-rgpd',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://kicsaxgnjgtzbqyljuyb.supabase.co/functions/v1/maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-maintenance-secret', (select value from private.app_config where key = 'maintenance_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
