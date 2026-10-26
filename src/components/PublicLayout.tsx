import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase, friendlyError, type PublicOrganization } from '../lib/supabase';

export function PublicLayout({ children, slug, orgName }: { children: ReactNode; slug?: string; orgName?: string }) {
  return (
    <div className="public">
      <header className="public-header">
        <Link to="/" className="public-brand">Persora</Link>
        {orgName && <span className="public-org">{orgName}</span>}
      </header>
      <main className="public-main">{children}</main>
      <footer className="public-footer">
        {slug && <Link to={`/confidentialite/${slug}`}>Confidentialité</Link>}
        {slug && <Link to={`/mes-donnees/${slug}`}>Mes données</Link>}
        <Link to="/mentions-legales">Mentions légales</Link>
        <Link to="/connexion">Espace recruteur</Link>
      </footer>
    </div>
  );
}

// Charge les informations publiques d'une entreprise à partir de son identifiant d'URL
export function usePublicOrg(slug: string | undefined) {
  const [org, setOrg] = useState<PublicOrganization | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    supabase.rpc('get_public_organization', { p_slug: slug }).then(({ data, error }) => {
      if (error) { setError(friendlyError(error)); setOrg(null); }
      else setOrg((data as PublicOrganization | null) ?? null);
    });
  }, [slug]);

  return { org, error };
}

export function OrgNotFound({ error }: { error: string | null }) {
  return (
    <PublicLayout>
      <div className="card narrow">
        <h1>Page introuvable</h1>
        <p>{error ?? "Cette entreprise n'existe pas ou n'utilise plus Persora."}</p>
      </div>
    </PublicLayout>
  );
}
