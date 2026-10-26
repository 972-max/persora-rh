import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  supabase, friendlyError, randomId, AVAILABILITY_LABELS, type Availability,
} from '../../lib/supabase';
import { useSession } from '../../lib/session';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Ajout d'une candidature que l'entreprise a reçue par un autre canal
// (e-mail, dépôt en agence). Le candidat a lui-même envoyé son CV : pas de collecte à son insu.
export default function ImportCandidate() {
  const { organization, canEdit } = useSession();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState('');
  const [availability, setAvailability] = useState<Availability | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!organization) return null;
  if (!canEdit) return <p className="error-text">Action réservée aux recruteurs et responsables RH.</p>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setSaving(true);
    setError(null);
    try {
      let cvPath: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('Fichier trop volumineux (5 Mo maximum).');
        if (file.type !== 'application/pdf' && file.type !== DOCX) throw new Error('Format accepté : PDF ou Word (.docx).');
        cvPath = `incoming/${randomId()}.${file.type === 'application/pdf' ? 'pdf' : 'docx'}`;
        const { error } = await supabase.storage.from('cvs').upload(cvPath, file, { contentType: file.type, upsert: false });
        if (error) throw error;
      }
      const { data, error } = await supabase.from('candidates').insert({
        organization_id: organization.id,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        city: city.trim() || null,
        experience_years: experience === '' ? null : Number(experience),
        availability: availability || null,
        cv_path: cvPath,
        source: 'import_rh',
        vivier_consent: false,
        privacy_notice_version: 'information-a-envoyer',
      }).select('id').single();
      if (error) {
        if (/uq_candidates_org_email|duplicate key/i.test(error.message)) throw new Error('Un candidat avec cet e-mail existe déjà.');
        throw error;
      }
      navigate(`/app/candidats/${data.id}`);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  const applyUrl = `${window.location.origin}/postuler/${organization.slug}`;

  return (
    <div>
      <Link to="/app" className="back">← Candidats</Link>
      <h1>Ajouter une candidature reçue</h1>
      <div className="info-box">
        <strong>Le plus simple :</strong> répondez au candidat avec votre lien de candidature ({applyUrl}).
        Il complète lui-même son profil et accepte la politique de confidentialité.
        Utilisez ce formulaire seulement pour une candidature qu'il vous a déjà envoyée.
      </div>
      <form className="card form-page" onSubmit={handleSubmit}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="name">Nom et prénom *</label>
            <input id="name" required minLength={2} maxLength={150} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail *</label>
            <input id="email" type="email" required maxLength={180} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">Téléphone</label>
            <input id="phone" type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="city">Ville</label>
            <input id="city" maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="exp">Années d'expérience</label>
            <input id="exp" type="number" min={0} max={60} step={0.5} value={experience} onChange={(e) => setExperience(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="avail">Disponibilité</label>
            <select id="avail" value={availability} onChange={(e) => setAvailability(e.target.value as Availability | '')}>
              <option value="">—</option>
              {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((a) => <option key={a} value={a}>{AVAILABILITY_LABELS[a]}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="cv">CV reçu (PDF ou Word)</label>
          <input id="cv" type="file" accept=".pdf,.docx,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <label className="check">
          <input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>
            Ce candidat nous a lui-même envoyé sa candidature, et je lui transmets le lien de notre politique de
            confidentialité dans ma réponse.
          </span>
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Ajout…' : 'Ajouter'}</button>
      </form>
    </div>
  );
}
