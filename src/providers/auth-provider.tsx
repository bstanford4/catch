import type { Session, User } from '@supabase/supabase-js';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { isDemoMode, supabase } from '@/lib/supabase';

type AuthResult = {
  error?: string;
  needsEmailConfirmation?: boolean;
};

type AuthContextValue = {
  isDemoMode: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (!error) setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isDemoMode,
      isLoading,
      session,
      user: session?.user ?? null,
      signIn: async (email, password) => {
        if (!supabase) return { error: 'Supabase is not configured. Use the seeded demo instead.' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      },
      signOut: async () => {
        if (!supabase) return {};
        const { error } = await supabase.auth.signOut();
        return error ? { error: error.message } : {};
      },
      signUp: async (email, password) => {
        if (!supabase) return { error: 'Supabase is not configured. Use the seeded demo instead.' };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              age_18_affirmed: true,
            },
          },
        });
        if (error) return { error: error.message };
        return { needsEmailConfirmation: !data.session };
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
