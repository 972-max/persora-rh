import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { OrgNotFound, PublicLayout, usePublicOrg } from '../../components/PublicLayout';
import { supabase, friendlyError, REQUEST_TYPE_LABELS, type DataRequest } from '../../lib/supabase';

type RequestType = DataRequest['request_type'];

export default function RightsRequest() {
  const { slug } = useParams<{ slug: string }>();
  const { org, error: orgError } = usePublicOrg(slug);
  const [email, setEmail] = useState('');
  const [type, setType] = useState<RequestType>('acces');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (org === undefined) return <PublicLayout><p className="page-loading">Chargement…</p></PublicLayout>;
  if (!org) return <OrgNotFound error={orgError} />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error } = await supabase.rpc('request_data_rights', {
      p_slug: slug, p_email: email, p_request_type: type, p_message: message,
    });
    setSending(false);
    if (error) setError(friendlyError(error));
    else setDone(true);
  }

  return (
    <PublicLayout slug={slug} orgName={org.name}>
      {done ? (
        <div className="card narrow">
          <h1>Demande enregistrée</h1>
          <p>
            {org.name} vous répondra par e-mail sous un mois. Pour protéger vos données, une preuve d'identité
            pourra vous être demandée en cas de doute.
          </p>
        </div>
      ) : (
        <form className="card form-page narrow" onSubmit={handleSubmit}>
          <h1>Mes données</h1>
          <p>
            Vous avez postulé chez {org.name} ? Indiquez l'adresse e-mail utilisée lors de votre candidature
            et ce que vous souhaitez.
          </p>
          <div className="field">
            <label htmlFor="email">E-mail utilisé pour postuler *</label>
            <input id="email" type="email" required maxLength={180} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="type">Votre demande *</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as RequestType)}>
              {(Object.keys(REQUEST_TYPE_LABELS) as RequestType[]).map((t) => (
                <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="msg">Précisions (facultatif)</label>
            <textarea id="msg" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="btn-primary btn-block" type="submit" disabled={sending}>
            {sending ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
        </form>
      )}
    </PublicLayout>
  );
}
