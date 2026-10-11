import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, Candidate, CONSENT_LABELS, StaffRole, fetchMyRole, friendlyError } from '../lib/supabase';

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = role === 'admin' || role === 'recruiter';

  useEffect(() => {
    fetchMyRole().then(setRole);
  }, []);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('candidates')
      .select('*, certifications(*)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error));
        else setCandidate(data as Candidate);
      });
  }, [id]);

  async function recordConsentEvent(eventType: 'informed' | 'opted_out') {
    if (!id || !canEdit) return;
    setSaving(true);
    setMessage(null);
    setActionError(null);
    const { error: insertError } = await supabase
      .from('consent_events')
      .insert({ candidate_id: id, event_type: eventType, channel: 'action_manuelle_rh' });
    if (insertError) {
      setActionError(friendlyError(insertError));
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase.from('candidates').update({ consent_status: eventType }).eq('id', id);
    setSaving(false);
    if (updateError) {
      setActionError(friendlyError(updateError));
      return;
    }
    setMessage(eventType === 'informed' ? 'Candidat marqué comme informé.' : "Opposition enregistrée — le profil sera retiré du vivier actif.");
    setCandidate((prev) => (prev ? { ...prev, consent_status: eventType } : prev));
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!candidate) return <p>Chargement…</p>;

  return (
    <div>
      <h1>{candidate.full_name}</h1>
      <p className="seg-meta">
        {candidate.experience_years ? `${candidate.experience_years} ans d'expérience` : 'Expérience non renseignée'}
        {candidate.availability ? ` — disponibilité : ${candidate.availability}` : ''}
      </p>

      {candidate.savoir_etre_score != null && (
        <div className="warn-box">
          Score de savoir-être indicatif : {(candidate.savoir_etre_score * 100).toFixed(0)}%. Ce score est une aide à la présélection,
          pas une décision automatisée — à valider impérativement par un entretien humain.
        </div>
      )}

      <h2>Certifications</h2>
      <div>
        {(candidate.certifications ?? []).map((cert) => (
          <span key={cert.id} className="tag">
            {cert.certification_type} {cert.is_verified ? '✓ vérifiée' : '(non vérifiée)'}
            {cert.expiry_date ? ` — exp. ${cert.expiry_date}` : ''}
          </span>
        ))}
      </div>

      <h2 style={{ marginTop: 20 }}>Consentement RGPD</h2>
      <div className="card" style={{ maxWidth: 480 }}>
        <p className="seg-meta">Statut actuel : <span className={`consent-badge consent-${candidate.consent_status}`}>{CONSENT_LABELS[candidate.consent_status]}</span></p>
        {canEdit ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn-primary" disabled={saving} onClick={() => recordConsentEvent('informed')}>Marquer comme informé</button>
            <button className="btn-ghost" disabled={saving} onClick={() => recordConsentEvent('opted_out')}>Enregistrer une opposition</button>
          </div>
        ) : (
          role && (
            <p className="seg-meta" style={{ marginTop: 10 }}>
              Vous êtes connecté en lecture seule : l'enregistrement du consentement est réservé aux recruteurs et aux responsables RH.
            </p>
          )
        )}
        {actionError && <p className="error-text" style={{ marginTop: 10 }}>{actionError}</p>}
        {message && <p className="seg-meta" style={{ marginTop: 10, color: 'var(--positive)' }}>{message}</p>}
      </div>
    </div>
  );
}
