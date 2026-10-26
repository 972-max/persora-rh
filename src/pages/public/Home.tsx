import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/PublicLayout';
import { EDITOR } from '../../lib/legal';

export default function Home() {
  return (
    <PublicLayout>
      <section className="hero">
        <h1>Le recrutement des agents de sécurité, sans les tableaux Excel</h1>
        <p className="lead">
          Persora centralise les candidatures de votre société de sécurité privée : carte professionnelle,
          SSIAP, SST et leurs dates d'expiration, disponibilité, expérience. Vos recruteurs voient en un coup d'œil
          qui peut être appelé aujourd'hui.
        </p>
        <div className="hero-actions">
          <a className="btn-primary" href={`mailto:${EDITOR.email}?subject=Démonstration Persora`}>Demander une démonstration</a>
          <Link className="btn-ghost" to="/connexion">Espace recruteur</Link>
        </div>
      </section>

      <section className="features">
        <div className="card">
          <h3>Une page de candidature à votre nom</h3>
          <p>Partagez un lien dans vos annonces : les candidats déposent leur CV et déclarent leurs certifications en deux minutes, depuis leur téléphone.</p>
        </div>
        <div className="card">
          <h3>Les certifications sous contrôle</h3>
          <p>Chaque carte pro, SSIAP ou SST a sa date d'expiration. Les échéances proches sont signalées, et vos recruteurs marquent ce qu'ils ont vérifié.</p>
        </div>
        <div className="card">
          <h3>Conforme au RGPD par conception</h3>
          <p>Les candidats postulent volontairement, sont informés, peuvent exercer leurs droits en ligne. Les profils sont supprimés automatiquement à la fin de la durée de conservation.</p>
        </div>
        <div className="card">
          <h3>Vos données restent les vôtres</h3>
          <p>Chaque entreprise ne voit que ses propres candidats. Données hébergées en France, droits d'accès par rôle, journal des actions.</p>
        </div>
      </section>
    </PublicLayout>
  );
}
