-- Comptes de démonstration pour l'authentification (Supabase Auth)
-- Mot de passe identique pour les 3 comptes : Persora2026!
-- ⚠️ À usage de démonstration uniquement — changer les mots de passe en production.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated', email,
  crypt('Persora2026!', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  json_build_object('full_name', full_name, 'role', role)::jsonb,
  now(), now(), '', '', '', ''
from staff_users;
-- Supabase Auth refuse les valeurs NULL dans les colonnes de jetons :
-- elles sont toutes initialisées à une chaîne vide.

-- Identité « email » de chaque compte, utilisée par Supabase Auth à la connexion.
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@crono-securite-demo.fr';

update staff_users s set id = u.id
from auth.users u where u.email = s.email;
