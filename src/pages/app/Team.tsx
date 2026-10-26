import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, friendlyError, ROLE_LABELS, type Membership, type Role } from '../../lib/supabase';
import { useSession } from '../../lib/session';

interface Issued { email: string; password: string }

async function manageMember(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-member', { body });
  if (error) {
    // L'erreur détaillée renvoyée par la fonction se trouve dans le corps de la réponse
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const payload = await ctx.json().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    throw error;
  }
  return data as { temporary_password: string | null; email?: string; existing_account?: boolean };
}

export default function Team() {
  const { organization, isAdmin, session } = useSession();
  const [members, setMembers] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('recruiter');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!organization) return;
    const { data, error } = await supabase.from('memberships').select('*')
      .eq('organization_id', organization.id).order('created_at');
    if (error) setError(friendlyError(error)); else setMembers(data as Membership[]);
  }, [organization]);

  useEffect(() => { load(); }, [load]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setBusy(true); setError(null); setIssued(null); setNotice(null);
    try {
      const r = await manageMember({ action: 'invite', organization_id: organization.id, email, full_name: fullName, role });
      if (r.temporary_password) setIssued({ email: email.trim().toLowerCase(), password: r.temporary_password });
      else setNotice(`${email} avait déjà un compte Persora : il a été ajouté à l'équipe avec son mot de passe actuel.`);
      setEmail(''); setFullName('');
      load();
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function resetPassword(m: Membership) {
    if (!organization || !window.confirm(`Attribuer un nouveau mot de passe provisoire à ${m.full_name} ?`)) return;
    setError(null); setIssued(null); setNotice(null);
    try {
      const r = await manageMember({ action: 'reset_password', organization_id: organization.id, user_id: m.user_id });
      if (r.temporary_password) setIssued({ email: m.full_name, password: r.temporary_password });
    } catch (err) { setError(friendlyError(err)); }
  }

  async function changeRole(m: Membership, newRole: Role) {
    const { error } = await supabase.from('memberships').update({ role: newRole })
      .eq('organization_id', m.organization_id).eq('user_id', m.user_id);
    if (error) setError(friendlyError(error)); else load();
  }

  async function remove(m: Membership) {
    if (!window.confirm(`Retirer ${m.full_name} de l'équipe ? Il n'aura plus accès aux candidats.`)) return;
    const { error } = await supabase.from('memberships').delete()
      .eq('organization_id', m.organization_id).eq('user_id', m.user_id);
    if (error) setError(friendlyError(error)); else load();
  }

  if (!organization) return null;

  return (
    <div>
      <h1>Équipe</h1>
      {error && <p className="error-text" role="alert">{error}</p>}
      {notice && <p className="ok-text">{notice}</p>}
      {issued && (
        <div className="info-box">
          <strong>Mot de passe provisoire pour {issued.email} :</strong>
          <code className="secret">{issued.password}</code>
          <p className="seg-meta">
            Il ne sera plus affiché. Transmettez-le de vive voix ou par SMS, jamais dans le même message que l'adresse de connexion.
            Il devra être changé à la première connexion sur {window.location.origin}/connexion.
          </p>
        </div>
      )}

      {members === null ? <p className="page-loading">Chargement…</p> : (
        <div className="card table-card">
          <table>
            <thead><tr><th>Nom</th><th>Rôle</th>{isAdmin && <th></th>}</tr></thead>
            <tbody>
              {members.map((m) => {
                const self = m.user_id === session?.user.id;
                return (
                  <tr key={m.user_id}>
                    <td>
                      <strong>{m.full_name}</strong>{self && <span className="seg-meta"> (vous)</span>}
                      {m.must_change_password && <div className="seg-meta">Première connexion en attente</div>}
                    </td>
                    <td>
                      {isAdmin && !self ? (
                        <select value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)} aria-label="Rôle">
                          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : ROLE_LABELS[m.role]}
                    </td>
                    {isAdmin && (
                      <td className="row-actions">
                        {!self && <button className="btn-ghost" onClick={() => resetPassword(m)}>Nouveau mot de passe</button>}
                        {!self && <button className="btn-ghost danger" onClick={() => remove(m)}>Retirer</button>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && (
        <form className="card form-page" onSubmit={invite}>
          <h2>Ajouter un membre</h2>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="n">Nom et prénom</label>
              <input id="n" required minLength={2} maxLength={150} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e">E-mail professionnel</label>
              <input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="r">Rôle</label>
              <select id="r" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <p className="seg-meta">
            Responsable RH : tout gérer, y compris l'équipe. Chargé de recrutement : candidats, offres et demandes RGPD.
            Lecture seule : consulter.
          </p>
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Création…' : 'Créer le compte'}</button>
        </form>
      )}
    </div>
  );
}
