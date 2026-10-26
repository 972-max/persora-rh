import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Membership, type Organization, type Role } from './supabase';

interface SessionState {
  session: Session | null | undefined; // undefined = chargement
  memberships: Membership[];
  current: Membership | null;
  organization: Organization | null;
  role: Role | null;
  canEdit: boolean;
  isAdmin: boolean;
  setCurrentOrg: (id: string) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);
const ORG_KEY = 'persora.currentOrg';

function readStoredOrg(): string | null {
  try { return window.localStorage.getItem(ORG_KEY); } catch { return null; }
}
function storeOrg(id: string) {
  try { window.localStorage.setItem(ORG_KEY, id); } catch { /* stockage indisponible */ }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(readStoredOrg());

  const loadMemberships = useCallback(async (s: Session | null) => {
    if (!s) { setMemberships([]); return; }
    const { data } = await supabase
      .from('memberships')
      .select('user_id, organization_id, role, full_name, must_change_password, organizations(*)')
      .eq('user_id', s.user.id);
    setMemberships((data as unknown as Membership[]) ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await loadMemberships(data.session);
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Différé pour ne pas bloquer le client Supabase pendant l'événement
        setTimeout(async () => {
          await loadMemberships(s);
          setSession(s);
        }, 0);
      } else {
        setSession(s);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadMemberships]);

  const current = useMemo(
    () => memberships.find((m) => m.organization_id === currentId) ?? memberships[0] ?? null,
    [memberships, currentId],
  );

  const value: SessionState = {
    session,
    memberships,
    current,
    organization: current?.organizations ?? null,
    role: current?.role ?? null,
    canEdit: current?.role === 'admin' || current?.role === 'recruiter',
    isAdmin: current?.role === 'admin',
    setCurrentOrg: (id) => { storeOrg(id); setCurrentId(id); },
    reload: async () => { const { data } = await supabase.auth.getSession(); await loadMemberships(data.session); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession doit être utilisé dans SessionProvider');
  return v;
}
