import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { OrgNotFound, PublicLayout, usePublicOrg } from '../../components/PublicLayout';
import {
  supabase, friendlyError, randomId,
  AVAILABILITY_LABELS, CERTIFICATION_LABELS,
  type Availability, type CertificationType,
} from '../../lib/supabase';
import { PRIVACY_NOTICE_VERSION } from '../../lib/legal';

const CERT_TYPES: CertificationType[] = ['carte_professionnelle', 'ssiap1', 'ssiap2', 'ssiap3', 'sst', 'h0b0'];
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function Apply() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const { org, error: orgError } = usePublicOrg(slug);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState('');
  const [availability, setAvailability] = useState<Availability | ''>('');
  const [offerId, setOfferId] = useState(params.get('offre') ?? '');
  const [certs, setCerts] = useState<Partial<Record<CertificationType, string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // champ piège anti-robots, invisible
  const [privacyRead, setPrivacyRead] = useState(false);
  const [vivierConsent, setVivierConsent] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (org === undefined) return <PublicLayout><p className="page-loading">Chargement…</p></PublicLayout>;
  if (!org) return <OrgNotFound error={orgError} />;

  function toggleCert(type: CertificationType, checked: boolean) {
    setCerts((prev) => {
      const next = { ...prev };
      if (checked) next[type] = prev[type] ?? '';
      else delete next[type];
      return next;
    });
  }

  function pickFile(f: File | null) {
    setError(null);
    if (!f) { setFile(null); return; }
    if (f.size > 5 * 1024 * 1024) { setError('Fichier trop volumineux (5 Mo maximum).'); return; }
    if (f.type !== 'application/pdf' && f.type !== DOCX) { setError('Format accepté : PDF ou Word (.docx).'); return; }
    setFile(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!org || !slug) return;
    if (website) { setDone(true); return; } // robot : on fait semblant d'accepter
    if (!privacyRead) { setError('Merci de confirmer avoir lu la politique de confidentialité.'); return; }
    setSending(true);
    setError(null);
    try {
      let cvPath: string | null = null;
      if (file) {
        const ext = file.type === 'application/pdf' ? 'pdf' : 'docx';
        cvPath = `incoming/${randomId()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('cvs').upload(cvPath, file, {
          contentType: file.type, upsert: false,
        });
        if (upErr) throw upErr;
      }
      const { error: rpcErr } = await supabase.rpc('submit_application', {
        p_slug: slug,
        p_full_name: fullName,
        p_email: email,
        p_phone: phone,
        p_city: city,
        p_experience_years: experience === '' ? null : Number(experience),
        p_availability: availability || null,
        p_message: message,
        p_job_offer_id: offerId || null,
        p_cv_path: cvPath,
        p_vivier_consent: vivierConsent,
        p_privacy_notice_version: PRIVACY_NOTICE_VERSION,
        p_certifications: Object.entries(certs).map(([type, expiry]) => ({ type, expiry_date: expiry || null })),
      });
      if (rpcErr) throw rpcErr;
      setDone(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <PublicLayout slug={slug} orgName={org.name}>
        <div className="card narrow">
          <h1>Candidature envoyée</h1>
          <p>Merci. L'équipe de recrutement de {org.name} étudiera votre profil et vous contactera si votre candidature correspond à un poste.</p>
          <p className="seg-meta">
            Vous pouvez à tout moment demander l'accès à vos données ou leur suppression depuis la page{' '}
            <Link to={`/mes-donnees/${slug}`}>Mes données</Link>.
          </p>
        </div>
      </PublicLayout>
    );
  }

  if (!org.is_accepting_applications) {
    return (
      <PublicLayout slug={slug} orgName={org.name}>
        <div className="card narrow">
          <h1>Candidatures fermées</h1>
          <p>{org.name} ne reçoit pas de candidatures en ligne pour le moment.</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout slug={slug} orgName={org.name}>
      <form className="card form-page" onSubmit={handleSubmit}>
        <h1>Postuler chez {org.name}</h1>
        <p className="seg-meta">Les champs marqués * sont obligatoires. Comptez deux minutes.</p>

        {org.offers.length > 0 && (
          <div className="field">
            <label htmlFor="offer">Poste</label>
            <select id="offer" value={offerId} onChange={(e) => setOfferId(e.target.value)}>
              <option value="">Candidature spontanée</option>
              {org.offers.map((o) => (
                <option key={o.id} value={o.id}>{o.title}{o.location ? ` — ${o.location}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid-2">
          <div className="field">
            <label htmlFor="name">Nom et prénom *</label>
            <input id="name" required minLength={2} maxLength={150} autoComplete="name"
              value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">E-mail *</label>
            <input id="email" type="email" required maxLength={180} autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">Téléphone</label>
            <input id="phone" type="tel" maxLength={30} autoComplete="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="city">Ville</label>
            <input id="city" maxLength={100} autoComplete="address-level2"
              value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="exp">Années d'expérience en sécurité</label>
            <input id="exp" type="number" min={0} max={60} step={0.5} inputMode="decimal"
              value={experience} onChange={(e) => setExperience(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="avail">Disponibilité</label>
            <select id="avail" value={availability} onChange={(e) => setAvailability(e.target.value as Availability | '')}>
              <option value="">—</option>
              {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((a) => (
                <option key={a} value={a}>{AVAILABILITY_LABELS[a]}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="field">
          <legend>Vos certifications</legend>
          <p className="seg-meta">Cochez celles que vous avez et indiquez leur date de fin de validité si vous la connaissez.</p>
          {CERT_TYPES.map((type) => {
            const checked = type in certs;
            return (
              <div key={type} className="cert-row">
                <label className="check">
                  <input type="checkbox" checked={checked} onChange={(e) => toggleCert(type, e.target.checked)} />
                  {CERTIFICATION_LABELS[type]}
                </label>
                {checked && (
                  <input type="date" aria-label={`Fin de validité ${CERTIFICATION_LABELS[type]}`}
                    value={certs[type] ?? ''} onChange={(e) => setCerts((p) => ({ ...p, [type]: e.target.value }))} />
                )}
              </div>
            );
          })}
        </fieldset>

        <div className="field">
          <label htmlFor="cv">CV (PDF ou Word, 5 Mo maximum)</label>
          <input id="cv" type="file" accept=".pdf,.docx,application/pdf" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          <p className="seg-meta">N'y mettez pas votre numéro de sécurité sociale ni d'informations sur votre santé.</p>
        </div>

        <div className="field">
          <label htmlFor="msg">Message (facultatif)</label>
          <textarea id="msg" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <div className="hp" aria-hidden="true">
          <label htmlFor="website">Site web</label>
          <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <div className="consent-block">
          <label className="check">
            <input type="checkbox" checked={privacyRead} onChange={(e) => setPrivacyRead(e.target.checked)} required />
            <span>
              J'ai lu la <Link to={`/confidentialite/${slug}`} target="_blank">politique de confidentialité</Link> *
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={vivierConsent} onChange={(e) => setVivierConsent(e.target.checked)} />
            <span>
              J'accepte que {org.name} conserve mon profil {org.retention_months} mois pour me proposer d'autres postes.
              Facultatif : sans cet accord, il est supprimé {org.retention_months_no_consent} mois après notre dernier échange.
            </span>
          </label>
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn-primary btn-block" type="submit" disabled={sending}>
          {sending ? 'Envoi…' : 'Envoyer ma candidature'}
        </button>
      </form>
    </PublicLayout>
  );
}
