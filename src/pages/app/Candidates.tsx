import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  supabase, friendlyError, formatYears, expiryState,
  STATUS_LABELS, CERTIFICATION_SHORT, AVAILABILITY_LABELS,
  type Candidate, type CandidateStatus, type CertificationType,
} from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { CopyLink } from '../../components/CopyLink';

export default function Candidates() {
  const { organization, canEdit } = useSession();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CandidateStatus | ''>('');
  const [cert, setCert] = useState<CertificationType | ''>('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!organization) return;
    setCandidates(null);
    supabase
      .from('candidates')
      .select('*, certifications(*), job_offers(title)')
      .eq('organization_id', organization.id)
      .order('applied_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error));
        else setCandidates(data as Candidate[]);
      });
    supabase
      .from('data_requests')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('status', 'a_traiter')
      .then(({ count }) => setPendingRequests(count ?? 0));
  }, [organization]);

  const filtered = useMemo(() => {
    if (!candidates) return [];
    const q = query.trim().toLowerCase();
    return candidates.filter((c) =>
      (!status || c.status === status)
      && (!cert || (c.certifications ?? []).some((x) => x.certification_type === cert && expiryState(x.expiry_date) !== 'expired'))
      && (!q || c.full_name.toLowerCase().includes(q) || c.email.includes(q) || (c.city ?? '').toLowerCase().includes(q)));
  }, [candidates, query, status, cert]);

  if (error) return <p className="error-text">{error}</p>;
  if (!candidates || !organization) return <p className="page-loading">Chargement…</p>;

  const toProcess = candidates.filter((c) => c.status === 'new').length;
  const expiring = candidates.filter((c) =>
    (c.certifications ?? []).some((x) => ['soon', 'expired'].includes(expiryState(x.expiry_date)))).length;
  const applyUrl = `${window.location.origin}/postuler/${organization.slug}`;

  return (
    <div>
      <div className="page-head">
        <h1>Candidats</h1>
        {canEdit && <Link className="btn-ghost" to="/app/candidats/nouveau">+ Ajouter une candidature reçue</Link>}
      </div>

      {!organization.is_accepting_applications && (
        <div className="warn-box">
          Votre page de candidature est fermée. {canEdit ? "Un responsable RH peut l'ouvrir dans l'onglet Entreprise." : ''}
        </div>
      )}
      {pendingRequests > 0 && (
        <div className="warn-box">
          {pendingRequests} demande{pendingRequests > 1 ? 's' : ''} RGPD en attente — délai légal de réponse : un mois.{' '}
          <Link to="/app/demandes">Voir</Link>
        </div>
      )}

      <div className="kpi-row">
        <div className="card kpi"><div className="num">{candidates.length}</div><div className="lbl">Candidats</div></div>
        <div className="card kpi"><div className="num">{toProcess}</div><div className="lbl">Nouveaux à traiter</div></div>
        <div className="card kpi"><div className="num">{expiring}</div><div className="lbl">Certification expirée ou à renouveler</div></div>
      </div>

      <div className="card share-card">
        <div>
          <strong>Votre lien de candidature</strong>
          <p className="seg-meta">À mettre dans vos annonces : les candidats y déposent leur CV et leurs certifications.</p>
        </div>
        <CopyLink url={applyUrl} />
      </div>

      <div className="filters">
        <input type="search" placeholder="Nom, e-mail ou ville" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher" />
        <select value={status} onChange={(e) => setStatus(e.target.value as CandidateStatus | '')} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as CandidateStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={cert} onChange={(e) => setCert(e.target.value as CertificationType | '')} aria-label="Certification">
          <option value="">Toutes certifications</option>
          {(Object.keys(CERTIFICATION_SHORT) as CertificationType[]).filter((c) => c !== 'autre').map((c) => (
            <option key={c} value={c}>{CERTIFICATION_SHORT[c]} valide</option>
          ))}
        </select>
      </div>

      {candidates.length === 0 ? (
        <div className="card empty">
          <h3>Aucune candidature pour l'instant</h3>
          <p>Partagez votre lien de candidature dans vos annonces, ou ajoutez une candidature reçue par e-mail.</p>
        </div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Candidat</th>
                <th>Expérience</th>
                <th>Disponibilité</th>
                <th>Certifications</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="candidate-row" onClick={() => navigate(`/app/candidats/${c.id}`)}>
                  <td>
                    <Link to={`/app/candidats/${c.id}`} onClick={(e) => e.stopPropagation()}><strong>{c.full_name}</strong></Link>
                    <div className="seg-meta">{c.city ?? ''}{c.job_offers?.title ? ` · ${c.job_offers.title}` : ''}</div>
                  </td>
                  <td>{formatYears(c.experience_years)}</td>
                  <td>{c.availability ? AVAILABILITY_LABELS[c.availability] : '—'}</td>
                  <td>
                    {(c.certifications ?? []).map((x) => (
                      <span key={x.id} className={`tag tag-${expiryState(x.expiry_date)}`} title={x.expiry_date ? `Fin de validité : ${x.expiry_date}` : 'Date non renseignée'}>
                        {CERTIFICATION_SHORT[x.certification_type]}{x.is_verified ? ' ✓' : ''}
                      </span>
                    ))}
                  </td>
                  <td><span className={`status-badge status-${c.status}`}>{STATUS_LABELS[c.status]}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="seg-meta">Aucun candidat ne correspond à ces filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="seg-meta legend">✓ certification vérifiée par l'équipe · orange : expire dans moins de 60 jours · rouge : expirée</p>
    </div>
  );
}
