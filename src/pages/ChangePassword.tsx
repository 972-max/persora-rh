import { useState, type FormEvent } from 'react';
import { supabase, friendlyError } from '../lib/supabase';
import { useSession } from '../lib/session';

export default function ChangePassword({ firstLogin = false }: { firstLogin?: boolean }) {
  const { session, reload } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (password.length < 12) { setError('Au moins 12 caractères.'); return; }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setSaving(false); setError(friendlyError(error)); return; }
    await supabase.rpc('mark_password_changed');
    setSaving(false);
    setPassword('');
    setConfirm('');
    setMessage('Mot de passe modifié.');
    await reload();
  }

  const form = (
    <form className={firstLogin ? 'card login-card' : 'card narrow'} onSubmit={handleSubmit}>
      <h1>{firstLogin ? 'Choisissez votre mot de passe' : 'Mon compte'}</h1>
      {firstLogin && <p className="seg-meta">Le mot de passe provisoire qui vous a été transmis doit être remplacé avant de continuer.</p>}
      {!firstLogin && <p className="seg-meta">Connecté avec {session?.user.email}</p>}
      <div className="field">
        <label htmlFor="pw">Nouveau mot de passe (12 caractères minimum)</label>
        <input id="pw" type="password" autoComplete="new-password" minLength={12} required
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pw2">Confirmez</label>
        <input id="pw2" type="password" autoComplete="new-password" minLength={12} required
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {message && <p className="ok-text">{message}</p>}
      <button className="btn-primary btn-block" type="submit" disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      {firstLogin && (
        <button type="button" className="btn-link" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      )}
    </form>
  );

  return firstLogin ? <div className="login-screen">{form}</div> : form;
}
