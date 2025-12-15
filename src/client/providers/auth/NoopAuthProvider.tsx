import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthContextValue } from './types';

const DEFAULT_USER_ID = 'default-user';

const noopValue: AuthContextValue = {
  isSignedIn: true,
  isLoaded: true,
  user: { id: DEFAULT_USER_ID },
  userId: DEFAULT_USER_ID,
  signIn: () => {},
  signOut: () => {},
  reloadUser: () => {},
  onUnavailable: () => {},
  checkAvailability: async () => true,
};

interface NoopAuthProviderProps {
  children: ReactNode;
}

export function NoopAuthProvider({ children }: NoopAuthProviderProps) {
  return (
    <AuthContext.Provider value={noopValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function NoopAuthUI() {
  return null;
}
