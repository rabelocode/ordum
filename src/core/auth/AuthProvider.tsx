import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { resetAnalyticsUser } from '../../lib/analytics';
import { getPilotE2EFixture } from '../../test/pilotE2EFixtures';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fixture = getPilotE2EFixture();
    if (fixture) {
      setSession(fixture.session);
      setUser(fixture.user);
      setIsLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') resetAnalyticsUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (getPilotE2EFixture()) {
      localStorage.removeItem('ordum_e2e_role');
      window.location.hash = '#/';
      return;
    }
    await supabase.auth.signOut();
    resetAnalyticsUser();
    window.location.hash = '#/';
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
