import { Link, useParams } from 'react-router-dom';
import { OrgNotFound, PublicLayout, usePublicOrg } from '../../components/PublicLayout';
import { EDITOR, HOSTS, MISSING, PRIVACY_NOTICE_VERSION } from '../../lib/legal';
import { formatDate } from '../../lib/supabase';

export default function Privacy() {
  const { slug } = useParams<{ slug: string }>();
  const { org, error } = usePublicOrg(slug);

  if (org === undefined) return <PublicLayout><p className="page-loading">Chargement…</p></PublicLayout>;
  if (!org) return <OrgNotFound error={error} />;

  const controller = org.legal_name ?? org.name;

  return (
    <PublicLayout slug={slug} orgName={org.name}>
      <article className="card legal">
        <h1>Politique de confidentialité — candidatures</h1>
        <p className="seg-meta">Version du {formatDate(PRIVACY_NOTICE_VERSION)}</p>

        <h2>Qui traite vos données</h2>
        <p>
          <strong>Responsable du traitement :</strong> {controller}, {org.address ?? MISSING}.
          Contact pour vos données : {org.privacy_contact_email
            ? <a href={`mailto:${org.privacy_contact_email}`}>{org.privacy_contact_email}</a>
            : MISSING}.
        </p>
        <p>
          <strong>Sous-traitant :</strong> {controller} utilise le logiciel Persora, édité par {EDITOR.name}, qui
          héberge et traite vos données pour son compte, uniquement selon ses instructions.
        </p>

        <h2>Pourquoi nous traitons vos données</h2>
        <ul>
          <li>
            <strong>Étudier votre candidature</strong> et vous contacter au sujet d'un poste. Base légale : les mesures
            précontractuelles prises à votre demande (article 6.1.b du RGPD), puisque c'est vous qui postulez.
          </li>
          <li>
            <strong>Vous proposer d'autres postes plus tard</strong>, uniquement si vous avez coché la case prévue.
            Base légale : votre consentement (article 6.1.a), que vous pouvez retirer à tout moment.
          </li>
        </ul>

        <h2>Les données concernées</h2>
        <p>
          Nom, e-mail, téléphone, ville, expérience, disponibilité, certifications professionnelles déclarées et leurs
          dates de validité, CV et message, ainsi que les notes de suivi de l'équipe de recrutement.
          Nous ne vous demandons aucune donnée sensible (santé, opinions, origine) : merci de ne pas en mettre dans
          votre CV.
        </p>

        <h2>Aucune décision automatique</h2>
        <p>
          Aucun algorithme ne trie, ne note ni ne refuse votre candidature. Chaque décision est prise par une personne
          de l'équipe de recrutement (article 22 du RGPD).
        </p>

        <h2>Qui y a accès</h2>
        <p>
          Uniquement les membres habilités de l'équipe de recrutement de {controller}. Vos données ne sont ni vendues,
          ni partagées avec d'autres entreprises utilisant Persora.
        </p>
        <p>Hébergement :</p>
        <ul>
          {HOSTS.map((h) => <li key={h.name}>{h.role} : {h.name}, {h.address}.</li>)}
        </ul>

        <h2>Combien de temps nous les gardons</h2>
        <ul>
          <li>Sans accord pour le vivier : {org.retention_months_no_consent} mois après notre dernier échange.</li>
          <li>Avec votre accord : {org.retention_months} mois après notre dernier échange.</li>
        </ul>
        <p>À l'issue de ce délai, votre profil et votre CV sont supprimés automatiquement.</p>

        <h2>Vos droits</h2>
        <p>
          Vous pouvez demander l'accès à vos données, leur rectification, leur suppression, leur portabilité,
          la limitation du traitement, vous y opposer, ou retirer votre accord pour le vivier.
          Faites-le depuis la page <Link to={`/mes-donnees/${slug}`}>Mes données</Link>
          {org.privacy_contact_email && <> ou par e-mail à {org.privacy_contact_email}</>}.
          Une réponse vous est apportée sous un mois.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL
          (<a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer">cnil.fr/plaintes</a>).
        </p>
      </article>
    </PublicLayout>
  );
}
