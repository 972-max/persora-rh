import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase, friendlyError, formatDate, type JobOffer } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { CopyLink } from '../../components/CopyLink';

export default function Offers() {
  const { organization, canEdit } = useSession();
  const [offers, setOffers] = useState<JobOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [contract, setContract] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!organization) return;
    const { data, error } = await supabase.from('job_offers').select('*')
      .eq('organization_id', organization.id).order('created_at', { ascending: false });
    if (error) setError(friendlyError(error));
    else setOffers(data as JobOffer[]);
  }, [organization]);

  useEffect(() => { load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('job_offers').insert({
      organization_id: organization.id, title: title.trim(),
      location: location.trim() || null, contract_type: contract.trim() || null,
      description: description.trim() || null,
    });
    setBusy(false);
    if (error) { setError(friendlyError(error)); return; }
    setTitle(''); setLocation(''); setContract(''); setDescription('');
    load();
  }

  async function togglePublished(o: JobOffer) {
    const { error } = await supabase.from('job_offers').update({ is_published: !o.is_published }).eq('id', o.id);
    if (error) setError(friendlyError(error)); else load();
  }

  async function remove(o: JobOffer) {
    if (!window.confirm(`Supprimer l'offre « ${o.title} » ? Les candidatures déjà reçues sont conservées.`)) return;
    const { error } = await supabase.from('job_offers').delete().eq('id', o.id);
    if (error) setError(friendlyError(error)); else load();
  }

  if (!organization) return null;
  const base = `${window.location.origin}/postuler/${organization.slug}`;

  return (
    <div>
      <h1>Offres</h1>
      <p className="seg-meta">Les offres publiées apparaissent dans la liste « Poste » de votre page de candidature.</p>
      {error && <p className="error-text" role="alert">{error}</p>}

      {offers === null ? <p className="page-loading">Chargement…</p> : (
        <div className="stack">
          {offers.length === 0 && <div className="card empty"><p>Aucune offre. Les candidats peuvent tout de même postuler spontanément.</p></div>}
          {offers.map((o) => (
            <div key={o.id} className="card offer">
              <div className="page-head">
                <div>
                  <h3>{o.title}</h3>
                  <p className="seg-meta">
                    {[o.location, o.contract_type].filter(Boolean).join(' · ')} — créée le {formatDate(o.created_at)}
                  </p>
                </div>
                <span className={`status-badge ${o.is_published ? 'status-qualified' : 'status-new'}`}>
                  {o.is_published ? 'Publiée' : 'Masquée'}
                </span>
              </div>
              {o.description && <p className="pre">{o.description}</p>}
              {o.is_published && <CopyLink url={`${base}?offre=${o.id}`} />}
              {canEdit && (
                <div className="row-actions">
                  <button className="btn-ghost" onClick={() => togglePublished(o)}>{o.is_published ? 'Masquer' : 'Publier'}</button>
                  <button className="btn-ghost danger" onClick={() => remove(o)}>Supprimer</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form className="card form-page" onSubmit={create}>
          <h2>Nouvelle offre</h2>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="t">Intitulé *</label>
              <input id="t" required minLength={3} maxLength={150} placeholder="Agent de sécurité SSIAP 1 — hôtel 5*" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="l">Lieu</label>
              <input id="l" maxLength={100} placeholder="Paris 16e" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="c">Contrat et horaires</label>
              <input id="c" maxLength={100} placeholder="CDI, nuit 19h–7h" value={contract} onChange={(e) => setContract(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="d">Description</label>
            <textarea id="d" rows={4} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button className="btn-primary" type="submit" disabled={busy}>Créer l'offre</button>
        </form>
      )}
    </div>
  );
}
