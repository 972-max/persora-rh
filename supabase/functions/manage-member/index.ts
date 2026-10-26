// Gestion de l'équipe d'une entreprise, réservée à ses responsables RH (rôle admin).
// action "invite" : crée le compte (ou rattache un compte existant) avec un mot de passe provisoire
// action "reset_password" : attribue un nouveau mot de passe provisoire à un membre
// Le mot de passe provisoire est renvoyé une seule fois, à transmettre en main propre.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// 16 caractères sans caractères ambigus (0/O, 1/l/I)
function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const ROLES = ['admin', 'recruiter', 'readonly'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  // Identité de l'appelant, à partir de son jeton de session
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller.user) return json({ error: 'Session invalide. Reconnectez-vous.' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide' }, 400); }

  const organizationId = String(body.organization_id ?? '');
  const action = String(body.action ?? '');

  const { data: callerMembership } = await admin
    .from('memberships').select('role')
    .eq('organization_id', organizationId).eq('user_id', caller.user.id).maybeSingle();
  if (callerMembership?.role !== 'admin') {
    return json({ error: 'Réservé aux responsables RH de cette entreprise.' }, 403);
  }

  if (action === 'invite') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.full_name ?? '').trim();
    const role = String(body.role ?? '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'E-mail invalide.' }, 400);
    if (fullName.length < 2 || fullName.length > 150) return json({ error: 'Nom invalide.' }, 400);
    if (!ROLES.includes(role)) return json({ error: 'Rôle invalide.' }, 400);

    const { data: existingId } = await admin.rpc('find_auth_user_id', { p_email: email });
    let userId = existingId as string | null;
    let password: string | null = null;

    if (userId) {
      const { data: already } = await admin.from('memberships').select('user_id')
        .eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
      if (already) return json({ error: 'Cette personne fait déjà partie de l\'équipe.' }, 409);
    } else {
      password = temporaryPassword();
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: fullName },
      });
      if (error || !created.user) return json({ error: error?.message ?? 'Création du compte impossible.' }, 500);
      userId = created.user.id;
    }

    const { error: insertErr } = await admin.from('memberships').insert({
      user_id: userId, organization_id: organizationId, role, full_name: fullName,
      must_change_password: password !== null,
    });
    if (insertErr) return json({ error: insertErr.message }, 500);

    await admin.from('audit_logs').insert({
      organization_id: organizationId, user_id: caller.user.id,
      action: `member.invite:${role}`, target_type: 'user', target_id: userId,
    });

    return json({ email, temporary_password: password, existing_account: password === null });
  }

  if (action === 'reset_password') {
    const userId = String(body.user_id ?? '');
    if (userId === caller.user.id) {
      return json({ error: 'Changez votre propre mot de passe depuis « Mon compte ».' }, 400);
    }
    const { data: member } = await admin.from('memberships').select('user_id')
      .eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    if (!member) return json({ error: 'Membre introuvable.' }, 404);

    const password = temporaryPassword();
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 500);
    await admin.from('memberships').update({ must_change_password: true }).eq('user_id', userId);
    await admin.from('audit_logs').insert({
      organization_id: organizationId, user_id: caller.user.id,
      action: 'member.reset_password', target_type: 'user', target_id: userId,
    });
    return json({ temporary_password: password });
  }

  return json({ error: 'Action inconnue.' }, 400);
});
