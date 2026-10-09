-- Données de démonstration synthétiques (aucun candidat réel)

insert into staff_users (full_name, email, role) values
  ('Responsable RH', 'rh.admin@crono-securite-demo.fr', 'admin'),
  ('Chargé de recrutement', 'recruteur@crono-securite-demo.fr', 'recruiter'),
  ('Consultation seule', 'lecture@crono-securite-demo.fr', 'readonly');

insert into sourcing_sources (id, name, platform_type, url_pattern, is_active) values
  ('a0000000-0000-0000-0000-000000000001', 'CV en ligne sécurité (échantillon)', 'cv_en_ligne', 'sample://cv/securite', true),
  ('a0000000-0000-0000-0000-000000000002', 'Plateforme emploi sûreté (échantillon)', 'plateforme_emploi', 'sample://emploi/surete', true);

insert into sourcing_jobs (source_id, status, candidates_found, started_at, finished_at) values
  ('a0000000-0000-0000-0000-000000000001', 'success', 14, now() - interval '1 day', now() - interval '23 hours'),
  ('a0000000-0000-0000-0000-000000000002', 'success', 9, now() - interval '1 day', now() - interval '23 hours 15 minutes');

insert into candidates (id, full_name, contact_email, source_id, source_url, experience_years, availability, savoir_etre_score, status, consent_status) values
  ('b0000000-0000-0000-0000-000000000001', 'Candidat Démo A', 'candidat.a@exemple-demo.fr', 'a0000000-0000-0000-0000-000000000001', 'sample://cv/securite/profil-a', 4.5, 'immediate', 0.82, 'qualified', 'informed'),
  ('b0000000-0000-0000-0000-000000000002', 'Candidat Démo B', 'candidat.b@exemple-demo.fr', 'a0000000-0000-0000-0000-000000000002', 'sample://emploi/surete/profil-b', 2.0, 'sous_preavis', 0.65, 'new', 'pending'),
  ('b0000000-0000-0000-0000-000000000003', 'Candidat Démo C', null, 'a0000000-0000-0000-0000-000000000001', 'sample://cv/securite/profil-c', 7.0, 'immediate', 0.91, 'interview_1', 'informed');

insert into certifications (candidate_id, certification_type, expiry_date, is_verified) values
  ('b0000000-0000-0000-0000-000000000001', 'carte_professionnelle', '2027-03-01', true),
  ('b0000000-0000-0000-0000-000000000001', 'ssiap', '2026-11-01', true),
  ('b0000000-0000-0000-0000-000000000002', 'carte_professionnelle', '2026-08-15', false),
  ('b0000000-0000-0000-0000-000000000003', 'carte_professionnelle', '2028-01-10', true),
  ('b0000000-0000-0000-0000-000000000003', 'sst', '2027-06-01', true);

insert into consent_events (candidate_id, event_type, channel) values
  ('b0000000-0000-0000-0000-000000000001', 'informed', 'email_automatique'),
  ('b0000000-0000-0000-0000-000000000003', 'informed', 'email_automatique');
