import { PublicLayout } from '../../components/PublicLayout';
import { EDITOR, HOSTS, MISSING } from '../../lib/legal';

export default function LegalNotice() {
  return (
    <PublicLayout>
      <article className="card legal">
        <h1>Mentions légales</h1>

        <h2>Éditeur</h2>
        <p>
          {EDITOR.name} — {EDITOR.status}<br />
          SIRET : {EDITOR.siret ?? MISSING}<br />
          Adresse : {EDITOR.address ?? MISSING}<br />
          Contact : <a href={`mailto:${EDITOR.email}`}>{EDITOR.email}</a><br />
          Directeur de la publication : {EDITOR.publicationDirector}
        </p>

        <h2>Hébergement</h2>
        <ul>
          {HOSTS.map((h) => <li key={h.name}><strong>{h.role}</strong> : {h.name}, {h.address}.</li>)}
        </ul>

        <h2>Données personnelles</h2>
        <p>
          Les candidatures déposées via Persora sont traitées pour le compte de l'entreprise auprès de laquelle vous
          postulez, qui en est responsable. Sa politique de confidentialité est accessible depuis sa page de candidature.
        </p>

        <h2>Cookies</h2>
        <p>
          Persora n'utilise aucun cookie publicitaire ni outil de mesure d'audience. Seul un stockage technique
          maintient la connexion des recruteurs à leur espace.
        </p>
      </article>
    </PublicLayout>
  );
}
