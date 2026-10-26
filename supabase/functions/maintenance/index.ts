// Maintenance RGPD de Persora, appelée toutes les heures par pg_cron.
// 1. Supprime les profils candidats dont la durée de conservation est dépassée
// 2. Efface du stockage les CV des profils supprimés et les dépôts jamais rattachés
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  // Seul pg_cron connaît ce secret (stocké en base, illisible depuis l'API publique)
  const { data: secret, error: secretErr } = await admin.rpc('maintenance_secret');
  const provided = req.headers.get('x-maintenance-secret') ?? '';
  if (secretErr || !secret || provided.length !== String(secret).length || provided !== secret) {
    return json({ error: 'Non autorisé' }, 401);
  }

  // 1. Profils expirés
  const { data: purged, error: purgeErr } = await admin
    .from('candidates')
    .delete()
    .lt('retention_until', new Date().toISOString())
    .select('id');
  if (purgeErr) return json({ error: purgeErr.message }, 500);

  // 2. Fichiers à effacer
  const { data: paths, error: queueErr } = await admin.rpc('storage_cleanup_queue');
  if (queueErr) return json({ error: queueErr.message }, 500);

  const toRemove: string[] = paths ?? [];
  let removed = 0;
  for (let i = 0; i < toRemove.length; i += 100) {
    const batch = toRemove.slice(i, i + 100);
    const { error } = await admin.storage.from('cvs').remove(batch);
    if (error) return json({ error: error.message, removed }, 500);
    const { error: confirmErr } = await admin.rpc('confirm_storage_cleanup', { p_paths: batch });
    if (confirmErr) return json({ error: confirmErr.message, removed }, 500);
    removed += batch.length;
  }

  return json({ purged_candidates: purged?.length ?? 0, removed_files: removed });
});
