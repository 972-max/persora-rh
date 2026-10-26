import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, friendlyError, formatDate, REQUEST_TYPE_LABELS, type DataRequest } from '../../lib/supabase';
import { useSession } from '../../lib/session';

const HELP: Record<DataRequest['request_type'], string> = {
  acces: "Envoyez au candidat, par e-mail, une copie de sa fiche (coordonnées, certifications, statut, notes) et de son CV.",
  suppression: 'Ouvrez la fiche du candidat et utilisez « Supprimer définitivement ce profil », puis confirmez-lui par e-mail.',
  rectification: 'Corrigez la fiche du candidat, ou invitez-le à repostuler via votre lien avec les bonnes informations.',
  opposition: "Arrêtez d'utiliser son profil : passez-le en « Non retenu » ou supprimez-le, puis confirmez-lui par e-mail.",
};

interface Row extends DataRequest { candidate_id?: string | null }

export default function Requests() {
  const { organization, canEdit, session } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const { data, error } = await supabase.from('data_requests').select('*')
      .eq('organization_id', organization.id).order('created_at', { ascending: false });
    if (error) { setError(friendlyError(error)); return; }
    const requests = data as DataRequest[];
    const emails = [...new Set(requests.map((r) => r.email))];
    const { data: cands } = emails.length
      ? await supabase.from('candidates').select('id, email').eq('organization_id', organization.id).in('email', emails)
      : { data: [] as { id: string; email: string }[] };
    const byEmail = new Map((cands ?? []).map((c) => [c.email, c.id]));
    setRows(requests.map((r) => ({ ...r, candidate_id: byEmail.get(r.email) ?? null })));
  }, [organization]);

  useEffect(() => { load(); }, [load]);

  async function close(r: Row, status: 'traitee' | 'rejetee') {
    if (!organization) return;
    const { error } = await supabase.from('data_requests')
      .update({ status, handled_at: new Date().toISOString(), handled_by: session?.user.id })
      .eq('id', r.id);
    if (error) { setError(friendlyError(error)); return; }
    if (r.candidate_id) {
      await supabase.from('privacy_events').insert({
        organization_id: organization.id, candidate_id: r.candidate_id,
        event_type: 'data_request_handled', actor: 'recruteur',
        detail: `${REQUEST_TYPE_LABELS[r.request_type]} — ${status === 'traitee' ? 'traitée' : 'rejetée'}`,
      });
    }
    load();
  }

  if (!organization) return null;

  return (
    <div>
      <h1>Demandes RGPD</h1>
      <p className="seg-meta">
        Les candidats déposent ces demandes depuis {window.location.origin}/mes-donnees/{organization.slug}.
        Vous devez y répondre sous un mois. En cas de doute sur l'identité, demandez une confirmation depuis l'adresse utilisée pour postuler.
      </p>
      {error && <p className="error-text" role="alert">{error}</p>}
      {rows === null ? <p className="page-loading">Chargement…</p> : rows.length === 0 ? (
        <div className="card empty"><p>Aucune demande.</p></div>
      ) : (
        <div className="stack">
          {rows.map((r) => {
            const deadline = new Date(r.created_at);
            deadline.setMonth(deadline.getMonth() + 1);
            const late = r.status === 'a_traiter' && deadline.getTime() < Date.now();
            return (
              <div key={r.id} className={`card request ${r.status === 'a_traiter' ? 'open' : ''}`}>
                <div className="page-head">
                  <div>
                    <h3>{REQUEST_TYPE_LABELS[r.request_type]}</h3>
                    <p className="seg-meta">{r.email} — reçue le {formatDate(r.created_at)}</p>
                  </div>
                  <span className={`status-badge ${r.status === 'a_traiter' ? (late ? 'status-rejected' : 'status-interview_1') : 'status-qualified'}`}>
                    {r.status === 'a_traiter' ? (late ? 'En retard' : `À traiter avant le ${formatDate(deadline.toISOString())}`)
                      : r.status === 'traitee' ? `Traitée le ${formatDate(r.handled_at)}` : `Rejetée le ${formatDate(r.handled_at)}`}
                  </span>
                </div>
                {r.message && <p className="quote">{r.message}</p>}
                <p>
                  {r.candidate_id
                    ? <Link to={`/app/candidats/${r.candidate_id}`}>Ouvrir la fiche du candidat</Link>
                    : <span className="seg-meta">Aucun candidat avec cette adresse : répondez-lui qu'aucune donnée n'est conservée à son nom.</span>}
                </p>
                {r.status === 'a_traiter' && (
                  <>
                    <p className="seg-meta">{HELP[r.request_type]}</p>
                    {canEdit && (
                      <div className="row-actions">
                        <button className="btn-primary" onClick={() => close(r, 'traitee')}>Marquer comme traitée</button>
                        <button className="btn-ghost" onClick={() => close(r, 'rejetee')}>Rejeter</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
