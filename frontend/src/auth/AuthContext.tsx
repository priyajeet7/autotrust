import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import type { Session, User } from '../api/types';

const TOKEN_KEY = 'autotrust.token';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; token: string; user: User };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    localStorage.getItem(TOKEN_KEY) ? { status: 'loading' } : { status: 'signedOut' },
  );

  // Validate a stored token once on start-up; drop it if the server rejects it.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    let cancelled = false;
    api
      .me(token)
      .then(({ user }) => {
        if (!cancelled) setState({ status: 'signedIn', token, user });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (!cancelled) setState({ status: 'signedOut' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const begin = useCallback((session: Session) => {
    localStorage.setItem(TOKEN_KEY, session.token);
    setState({ status: 'signedIn', token: session.token, user: session.user });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login: async (email, password) => begin(await api.login(email, password)),
      register: async (name, email, password) => begin(await api.register(name, email, password)),
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setState({ status: 'signedOut' });
      },
    }),
    [state, begin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
