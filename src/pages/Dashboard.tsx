import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Candidate, friendlyError } from '../lib/supabase';

const STATUS_LABELS: Record<string, string> = {
  new: 'Nouveau', contacted: 'Contacté', qualified: 'Qualifié',
  interview_1: 'Entretien 1', interview_2: 'Entretien 2', rejected: 'Refusé', hired: 'Recruté',
};
const CONSENT_LABELS: Record<string, string> = {
  pending: 'Consentement en attente', informed: 'Informé', opted_out: "S'est opposé",
};

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('candidates')
      .select('*, certifications(*)')
      .order('discovered_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error));
        else setCandidates(data as Candidate[]);
      });
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!candidates) return <p>Chargement…</p>;

  const qualified = candidates.filter((c) => c.status === 'qualified' || c.status.startsWith('interview')).length;
  const pendingConsent = candidates.filter((c) => c.consent_status === 'pending').length;

  return (
    <div>
      <h1>Vivier de candidats</h1>
      <div className="kpi-row">
        <div className="card kpi"><div className="num">{candidates.length}</div><div className="lbl">Profils dans le vivier</div></div>
        <div className="card kpi"><div className="num">{qualified}</div><div className="lbl">Qualifiés ou en entretien</div></div>
        <div className="card kpi"><div className="num">{pendingConsent}</div><div className="lbl">Consentement en attente</div></div>
      </div>

      {pendingConsent > 0 && (
        <div className="warn-box">
          {pendingConsent} profil(s) en attente d'information sur leur intégration au vivier (droit d'opposition RGPD).
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Candidat</th>
              <th>Expérience</th>
              <th>Certifications</th>
              <th>Statut</th>
              <th>Consentement</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="candidate-row" onClick={() => navigate(`/candidates/${c.id}`)}>
                <td><strong>{c.full_name}</strong></td>
                <td>{c.experience_years ? `${c.experience_years} ans` : '—'}</td>
                <td>
                  {(c.certifications ?? []).map((cert) => (
                    <span key={cert.id} className="tag">{cert.certification_type}</span>
                  ))}
                </td>
                <td><span className={`status-badge status-${c.status}`}>{STATUS_LABELS[c.status]}</span></td>
                <td><span className={`consent-badge consent-${c.consent_status}`}>{CONSENT_LABELS[c.consent_status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
