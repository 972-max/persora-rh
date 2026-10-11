import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, Link, useNavigate } from 'react-router-dom';
import { supabase, fetchMyRole, ROLE_LABELS, StaffRole } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CandidateDetail from './pages/CandidateDetail';

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [role, setRole] = useState<StaffRole | null>(null);
  useEffect(() => {
    fetchMyRole().then(setRole);
  }, []);
  async function logout() {
    await supabase.auth.signOut();
    navigate('/login');
  }
  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">Persora RH</div>
        {role && <div className="role-chip">{ROLE_LABELS[role]}</div>}
        <Link to="/" className="active">Vivier de candidats</Link>
        <a onClick={logout} style={{ cursor: 'pointer', marginTop: 16 }}>Se déconnecter</a>
      </nav>
      <div className="main">{children}</div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p style={{ padding: 24 }}>Chargement…</p>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/"
          element={session ? <Shell><Dashboard /></Shell> : <Navigate to="/login" replace />}
        />
        <Route
          path="/candidates/:id"
          element={session ? <Shell><CandidateDetail /></Shell> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
