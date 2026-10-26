import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase, friendlyError } from '../../lib/supabase';
import { useSession } from '../../lib/session';

export default function Settings() {
  const { organization, isAdmin, reload } = useSession();
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [retention, setRetention] = useState(24);
  const [retentionNoConsent, setRetentionNoConsent] = useState(6);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    setLegalName(organization.legal_name ?? '');
    setAddress(organization.address ?? '');
    setContact(organization.privacy_contact_email ?? '');
    setAccepting(organization.is_accepting_applications);
    setRetention(organization.retention_months);
    setRetentionNoConsent(organization.retention_months_no_consent);
  }, [organization]);

  if (!organization) return null;
  if (!isAdmin) return <p className="error-text">Réservé aux responsables RH.</p>;

  const legalComplete = legalName.trim() && address.trim() && contact.trim();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!organization) return;
    setError(null); setMessage(null);
    if (accepting && !legalComplete) {
      setError("Renseignez la raison sociale, l'adresse et le contact données personnelles avant d'ouvrir les candidatures : ils figurent dans votre politique de confidentialité.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('organizations').update({
      name: name.trim(),
      legal_name: legalName.trim() || null,
      address: address.trim() || null,
      privacy_contact_email: contact.trim() || null,
      is_accepting_applications: accepting,
      retention_months: retention,
      retention_months_no_consent: retentionNoConsent,
    }).eq('id', organization.id);
    setSaving(false);
    if (error) { setError(friendlyError(error)); return; }
    setMessage('Enregistré.');
    await reload();
  }

  return (
    <div>
      <h1>Entreprise</h1>
      <form className="card form-page" onSubmit={save}>
        <h2>Identité</h2>
        <p className="seg-meta">
          Ces informations apparaissent dans votre <Link to={`/confidentialite/${organization.slug}`} target="_blank">politique de confidentialité</Link>,
          car votre entreprise est responsable du traitement des candidatures.
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="name">Nom affiché aux candidats</label>
            <input id="name" required minLength={2} maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="legal">Raison sociale</label>
            <input id="legal" maxLength={150} placeholder="Ex. Société X SAS" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="addr">Adresse du siège</label>
            <input id="addr" maxLength={250} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="contact">E-mail de contact pour les données personnelles</label>
            <input id="contact" type="email" maxLength={180} placeholder="rgpd@votre-entreprise.fr" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
        </div>

        <h2>Conservation des profils</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ret">Avec accord du candidat pour le vivier (mois)</label>
            <input id="ret" type="number" min={1} max={36} value={retention} onChange={(e) => setRetention(Number(e.target.value))} />
            <p className="seg-meta">La CNIL recommande de ne pas dépasser 2 ans après le dernier contact.</p>
          </div>
          <div className="field">
            <label htmlFor="ret2">Sans accord (mois)</label>
            <input id="ret2" type="number" min={1} max={12} value={retentionNoConsent} onChange={(e) => setRetentionNoConsent(Number(e.target.value))} />
            <p className="seg-meta">Le temps de mener le recrutement en cours.</p>
          </div>
        </div>
        <p className="seg-meta">Une modification s'applique aux profils au prochain échange avec chaque candidat.</p>

        <h2>Page de candidature</h2>
        <label className="check">
          <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} />
          <span>Recevoir des candidatures en ligne sur {window.location.origin}/postuler/{organization.slug}</span>
        </label>
        {!legalComplete && <p className="seg-meta">Complétez d'abord votre identité pour pouvoir l'ouvrir.</p>}

        {error && <p className="error-text" role="alert">{error}</p>}
        {message && <p className="ok-text">{message}</p>}
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </div>
  );
}
