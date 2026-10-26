import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  supabase, friendlyError, formatDate, formatYears, expiryState,
  STATUS_LABELS, AVAILABILITY_LABELS, CERTIFICATION_LABELS, PRIVACY_EVENT_LABELS,
  type Candidate, type CandidateStatus, type CertificationType, type PrivacyEvent,
} from '../../lib/supabase';
import { useSession } from '../../lib/session';

const EXPIRY_TEXT = { ok: '', soon: ' — expire bientôt', expired: ' — expirée', unknown: ' — date non renseignée' };

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, session } = useSession();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [events, setEvents] = useState<PrivacyEvent[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCertType, setNewCertType] = useState<CertificationType>('carte_professionnelle');
  const [newCertExpiry, setNewCertExpiry] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('candidates').select('*, certifications(*), job_offers(title)').eq('id', id).maybeSingle();
    if (error) { setError(friendlyError(error)); return; }
    if (!data) { setError('Candidat introuvable ou supprimé.'); return; }
    setCandidate(data as Candidate);
    setNotes((data as Candidate).internal_notes ?? '');
    const { data: ev } = await supabase
      .from('privacy_events').select('*').eq('candidate_id', id).order('created_at', { ascending: false });
    setEvents((ev as PrivacyEvent[]) ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function run(action: () => Promise<{ error: unknown }>, success: string) {
    setBusy(true);
    setActionError(null);
    setMessage(null);
    const { error } = await action();
    setBusy(false);
    if (error) { setActionError(friendlyError(error)); return; }
    setMessage(success);
    await load();
  }

  async function openCv() {
    if (!candidate?.cv_path) return;
    const { data, error } = await supabase.storage.from('cvs').createSignedUrl(candidate.cv_path, 60);
    if (error || !data) { setActionError(friendlyError(error)); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function deleteCandidate() {
    if (!candidate) return;
    const ok = window.confirm(`Supprimer définitivement le profil de ${candidate.full_name} et son CV ? Cette action est irréversible.`);
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.from('candidates').delete().eq('id', candidate.id);
    setBusy(false);
    if (error) { setActionError(friendlyError(error)); return; }
    navigate('/app', { replace: true });
  }

  if (error) return <div><p className="error-text">{error}</p><Link to="/app">← Retour aux candidats</Link></div>;
  if (!candidate) return <p className="page-loading">Chargement…</p>;

  const certs = candidate.certifications ?? [];

  return (
    <div className="detail">
      <Link to="/app" className="back">← Candidats</Link>
      <div className="page-head">
        <div>
          <h1>{candidate.full_name}</h1>
          <p className="seg-meta">
            {candidate.source === 'candidature_directe' ? 'Candidature en ligne' : 'Candidature reçue et ajoutée par l\'équipe'}
            {' '}du {formatDate(candidate.applied_at)}
            {candidate.job_offers?.title ? ` — ${candidate.job_offers.title}` : ' — candidature spontanée'}
          </p>
        </div>
        <span className={`status-badge status-${candidate.status}`}>{STATUS_LABELS[candidate.status]}</span>
      </div>

      {actionError && <p className="error-text" role="alert">{actionError}</p>}
      {message && <p className="ok-text">{message}</p>}

      <div className="detail-grid">
        <section className="card">
          <h2>Coordonnées</h2>
          <dl className="facts">
            <dt>E-mail</dt><dd><a href={`mailto:${candidate.email}`}>{candidate.email}</a></dd>
            <dt>Téléphone</dt><dd>{candidate.phone ? <a href={`tel:${candidate.phone}`}>{candidate.phone}</a> : '—'}</dd>
            <dt>Ville</dt><dd>{candidate.city ?? '—'}</dd>
            <dt>Expérience</dt><dd>{formatYears(candidate.experience_years)}</dd>
            <dt>Disponibilité</dt><dd>{candidate.availability ? AVAILABILITY_LABELS[candidate.availability] : '—'}</dd>
            <dt>CV</dt>
            <dd>{candidate.cv_path ? <button className="btn-link" onClick={openCv}>Ouvrir le CV</button> : 'Non fourni'}</dd>
          </dl>
          {candidate.message && (
            <>
              <h3>Message du candidat</h3>
              <p className="quote">{candidate.message}</p>
            </>
          )}
        </section>

        <section className="card">
          <h2>Suivi</h2>
          <div className="field">
            <label htmlFor="status">Statut</label>
            <select id="status" value={candidate.status} disabled={!canEdit || busy}
              onChange={(e) => run(
                async () => supabase.from('candidates')
                  .update({ status: e.target.value as CandidateStatus, last_activity_at: new Date().toISOString() })
                  .eq('id', candidate.id),
                'Statut mis à jour.')}>
              {(Object.keys(STATUS_LABELS) as CandidateStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="notes">Notes internes</label>
            <textarea id="notes" rows={4} maxLength={5000} value={notes} disabled={!canEdit}
              onChange={(e) => setNotes(e.target.value)} />
            <p className="seg-meta">
              Le candidat peut demander à les consulter : restez factuel (disponibilités, échanges, vérifications).
            </p>
          </div>
          {canEdit && (
            <button className="btn-ghost" disabled={busy || notes === (candidate.internal_notes ?? '')}
              onClick={() => run(async () => supabase.from('candidates').update({ internal_notes: notes || null }).eq('id', candidate.id), 'Notes enregistrées.')}>
              Enregistrer les notes
            </button>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Certifications</h2>
        {certs.length === 0 && <p className="seg-meta">Aucune certification déclarée.</p>}
        <ul className="cert-list">
          {certs.map((c) => {
            const state = expiryState(c.expiry_date);
            return (
              <li key={c.id} className={`cert cert-${state}`}>
                <div>
                  <strong>{CERTIFICATION_LABELS[c.certification_type]}</strong>
                  <span className="seg-meta">
                    {' '}{c.expiry_date ? `valide jusqu'au ${formatDate(c.expiry_date)}` : ''}{EXPIRY_TEXT[state]}
                    {' · '}{c.declared_by === 'candidat' ? 'déclarée par le candidat' : "ajoutée par l'équipe"}
                  </span>
                </div>
                <div className="cert-actions">
                  {c.is_verified
                    ? <span className="verified">✓ Vérifiée le {formatDate(c.verified_at)}</span>
                    : <span className="seg-meta">Non vérifiée</span>}
                  {canEdit && (
                    <button className="btn-ghost" disabled={busy} onClick={() => run(
                      async () => supabase.from('certifications').update(c.is_verified
                        ? { is_verified: false, verified_by: null, verified_at: null }
                        : { is_verified: true, verified_by: session?.user.id, verified_at: new Date().toISOString() })
                        .eq('id', c.id),
                      c.is_verified ? 'Vérification retirée.' : 'Certification marquée comme vérifiée.')}>
                      {c.is_verified ? 'Annuler' : 'Marquer vérifiée'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {canEdit && (
          <div className="inline-form">
            <select value={newCertType} onChange={(e) => setNewCertType(e.target.value as CertificationType)} aria-label="Type">
              {(Object.keys(CERTIFICATION_LABELS) as CertificationType[]).map((t) => <option key={t} value={t}>{CERTIFICATION_LABELS[t]}</option>)}
            </select>
            <input type="date" value={newCertExpiry} onChange={(e) => setNewCertExpiry(e.target.value)} aria-label="Fin de validité" />
            <button className="btn-ghost" disabled={busy} onClick={() => run(async () => {
              const r = await supabase.from('certifications').insert({
                organization_id: candidate.organization_id, candidate_id: candidate.id,
                certification_type: newCertType, expiry_date: newCertExpiry || null, declared_by: 'recruteur',
              });
              setNewCertExpiry('');
              return r;
            }, 'Certification ajoutée.')}>Ajouter</button>
          </div>
        )}
        <p className="seg-meta">
          Vérifiez la carte professionnelle sur le téléservice du CNAPS avant toute embauche.
        </p>
      </section>

      <section className="card">
        <h2>Données personnelles</h2>
        <p>
          {candidate.vivier_consent
            ? 'Le candidat a accepté que son profil soit conservé pour d\'autres postes.'
            : 'Le candidat n\'a pas donné son accord pour le vivier : son profil ne sert qu\'au recrutement en cours.'}
          {' '}Suppression automatique prévue le <strong>{formatDate(candidate.retention_until)}</strong>{' '}
          (chaque échange avec le candidat repousse cette date).
        </p>
        <h3>Historique</h3>
        <ul className="timeline">
          {events.map((ev) => (
            <li key={ev.id}>
              <span className="seg-meta">{formatDate(ev.created_at)}</span> — {PRIVACY_EVENT_LABELS[ev.event_type] ?? ev.event_type}
              {ev.detail ? <span className="seg-meta"> ({ev.detail})</span> : null}
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="danger-zone">
            <button className="btn-danger" disabled={busy} onClick={deleteCandidate}>Supprimer définitivement ce profil</button>
            <p className="seg-meta">À utiliser pour répondre à une demande de suppression. Le CV est effacé du stockage dans l'heure.</p>
          </div>
        )}
      </section>
    </div>
  );
}
