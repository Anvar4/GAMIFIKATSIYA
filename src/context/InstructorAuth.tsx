// Oʻqituvchi autentifikatsiyasi (Supabase Auth, email + parol).
// Rol serverdagi profiles.role orqali tekshiriladi — frontendda parol yoki kalit saqlanmaydi.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getInstructorClient } from '../lib/supabase';
import { env } from '../lib/env';
import { errorMessage } from '../lib/errors';

export interface Profile {
  id: string;
  display_name: string;
  role: 'instructor' | 'student';
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  error: string | null;
  isInstructor: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function InstructorAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(env.isConfigured);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const client = getInstructorClient();
    const { data, error: e } = await client.from('profiles').select('id, display_name, role').eq('id', s.user.id).maybeSingle();
    if (e) setError(errorMessage(e));
    setProfile((data as Profile | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!env.isConfigured) return;
    const client = getInstructorClient();
    client.auth
      .getSession()
      .then(({ data }) => loadProfile(data.session))
      .catch((e) => {
        setError(errorMessage(e));
        setLoading(false);
      });
    const { data: sub } = client.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') return;
      // auth callback ichida boshqa soʻrov yubormaslik uchun keyingi tick'ga qoldiriladi
      window.setTimeout(() => void loadProfile(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const client = getInstructorClient();
    const { data, error: e } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (e) throw e;
    await loadProfile(data.session);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await getInstructorClient().auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile,
      error,
      isInstructor: profile?.role === 'instructor',
      signIn,
      signOut,
    }),
    [loading, session, profile, error, signIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInstructorAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('InstructorAuthProvider topilmadi');
  return v;
}
