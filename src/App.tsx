import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate, Link } from 'react-router-dom';
import { supabase, ROLE_LABELS } from './lib/supabase';
import { SessionProvider, useSession } from './lib/session';
import Home from './pages/public/Home';
import Apply from './pages/public/Apply';
import Privacy from './pages/public/Privacy';
import RightsRequest from './pages/public/RightsRequest';
import LegalNotice from './pages/public/LegalNotice';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Candidates from './pages/app/Candidates';
import CandidateDetail from './pages/app/CandidateDetail';
import ImportCandidate from './pages/app/ImportCandidate';
import Offers from './pages/app/Offers';
import Requests from './pages/app/Requests';
import Team from './pages/app/Team';
import Settings from './pages/app/Settings';

function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { memberships, current, organization, role, isAdmin, setCurrentOrg } = useSession();

  async function logout() {
    await supabase.auth.signOut();
    navigate('/connexion');
  }

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <Link to="/app" className="brand">Persora</Link>
        {memberships.length > 1 ? (
          <select
            className="org-switch"
            value={current?.organization_id}
            onChange={(e) => setCurrentOrg(e.target.value)}
            aria-label="Entreprise"
          >
            {memberships.map((m) => (
              <option key={m.organization_id} value={m.organization_id}>{m.organizations?.name}</option>
            ))}
          </select>
        ) : (
          <div className="org-name">{organization?.name}</div>
        )}
        {role && <div className="role-chip">{ROLE_LABELS[role]}</div>}
        <NavLink to="/app" end>Candidats</NavLink>
        <NavLink to="/app/offres">Offres</NavLink>
        <NavLink to="/app/demandes">Demandes RGPD</NavLink>
        <NavLink to="/app/equipe">Équipe</NavLink>
        {isAdmin && <NavLink to="/app/entreprise">Entreprise</NavLink>}
        <NavLink to="/app/mot-de-passe">Mon compte</NavLink>
        <a onClick={logout} role="button" tabIndex={0} className="logout">Se déconnecter</a>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, memberships, current } = useSession();
  if (session === undefined) return <p className="page-loading">Chargement…</p>;
  if (!session) return <Navigate to="/connexion" replace />;
  if (memberships.length === 0) {
    return (
      <div className="login-screen">
        <div className="card login-card">
          <h1>Accès non configuré</h1>
          <p>Votre compte n'est rattaché à aucune entreprise. Contactez le responsable RH qui vous a invité.</p>
          <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
        </div>
      </div>
    );
  }
  if (current?.must_change_password) return <ChangePassword firstLogin />;
  return <Shell>{children}</Shell>;
}

function AppRoutes() {
  const { session } = useSession();
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/postuler/:slug" element={<Apply />} />
      <Route path="/confidentialite/:slug" element={<Privacy />} />
      <Route path="/mes-donnees/:slug" element={<RightsRequest />} />
      <Route path="/mentions-legales" element={<LegalNotice />} />
      <Route path="/connexion" element={session ? <Navigate to="/app" replace /> : <Login />} />

      <Route path="/app" element={<RequireAuth><Candidates /></RequireAuth>} />
      <Route path="/app/candidats/nouveau" element={<RequireAuth><ImportCandidate /></RequireAuth>} />
      <Route path="/app/candidats/:id" element={<RequireAuth><CandidateDetail /></RequireAuth>} />
      <Route path="/app/offres" element={<RequireAuth><Offers /></RequireAuth>} />
      <Route path="/app/demandes" element={<RequireAuth><Requests /></RequireAuth>} />
      <Route path="/app/equipe" element={<RequireAuth><Team /></RequireAuth>} />
      <Route path="/app/entreprise" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/app/mot-de-passe" element={<RequireAuth><ChangePassword /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  );
}
