import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { SyncStreamConnectionMethod } from '@powersync/react-native';

import { SupabaseConnector } from '@/db/connector';
import { powersync } from '@/db';
import { backendConfigured, supabase } from '@/lib/supabase';

export type Role = 'owner' | 'munshi';

export interface Member {
  userId: string;
  email: string | null;
  businessId: string;
  businessName: string;
  role: Role;
}

type State =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noMembership' }
  | { status: 'ready'; member: Member };

interface SessionContextValue {
  state: State;
  /** True when .env.local is missing: no sign-in, no sync, data stays on this phone. */
  localMode: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// Fixed ids for local-only test mode. Rows written in this mode will be rejected if the
// phone is later pointed at a real backend — clear app data before switching.
const LOCAL_MEMBER: Member = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: null,
  businessId: '00000000-0000-4000-8000-000000000002',
  businessName: 'ٹیسٹ کمپنی',
  role: 'owner',
};

const memberKey = (userId: string) => `member:${userId}`;

async function loadMember(session: AuthSession): Promise<Member | null> {
  const cached = await AsyncStorage.getItem(memberKey(session.user.id));
  if (cached) return JSON.parse(cached) as Member;

  const { data, error } = await supabase!
    .from('membership')
    .select('business_id, role, business(name)')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const business = data.business as unknown as { name: string } | null;
  const member: Member = {
    userId: session.user.id,
    email: session.user.email ?? null,
    businessId: data.business_id,
    businessName: business?.name ?? '',
    role: data.role as Role,
  };
  await AsyncStorage.setItem(memberKey(session.user.id), JSON.stringify(member));
  return member;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(
    backendConfigured ? { status: 'loading' } : { status: 'ready', member: LOCAL_MEMBER },
  );

  useEffect(() => {
    if (!supabase) return;

    async function apply(session: AuthSession | null) {
      if (!session) {
        setState({ status: 'signedOut' });
        return;
      }
      try {
        const member = await loadMember(session);
        if (!member) {
          setState({ status: 'noMembership' });
          return;
        }
        setState({ status: 'ready', member });
        // WebSocket, not the SDK's default HTTP stream: on the Android dev build the HTTP
        // sync stream opened but never delivered a line (expo/fetch), so nothing downloaded.
        powersync
          .connect(new SupabaseConnector(), { connectionMethod: SyncStreamConnectionMethod.WEB_SOCKET })
          .catch((e) => console.warn('[sync] connect failed', e));
      } catch {
        // First sign-in with no network: stay signed out rather than guess the business.
        setState({ status: 'signedOut' });
      }
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase holds its auth lock while this callback runs; calling other Supabase
      // methods from inside it (loadMember, PowerSync's fetchCredentials) can deadlock.
      // Defer the work until the callback has returned.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => apply(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    return !error;
  }

  async function signOut() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) await AsyncStorage.removeItem(memberKey(data.session.user.id));
    await AsyncStorage.removeItem('activeProjectId');
    await powersync.disconnectAndClear();
    await supabase.auth.signOut();
  }

  return (
    <SessionContext value={{ state, localMode: !backendConfigured, signIn, signOut }}>{children}</SessionContext>
  );
}

export function useSession() {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

/** The signed-in member. Only call from screens behind the auth gate. */
export function useMember(): Member {
  const { state } = useSession();
  if (state.status !== 'ready') throw new Error('useMember before sign-in');
  return state.member;
}

export function useWriteContext() {
  const m = useMember();
  return { businessId: m.businessId, userId: m.userId };
}
