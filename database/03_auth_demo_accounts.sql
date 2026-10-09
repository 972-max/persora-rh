-- Comptes de démonstration pour l'authentification (Supabase Auth)
-- Mot de passe identique pour les 3 comptes : Persora2026!
-- ⚠️ À usage de démonstration uniquement — changer les mots de passe en production.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated', email,
  crypt('Persora2026!', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  json_build_object('full_name', full_name, 'role', role)::jsonb,
  now(), now(), '', ''
from staff_users;

update staff_users s set id = u.id
from auth.users u where u.email = s.email;
