import type { ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthContextValue, AuthMenuItemsProps } from './types';

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
  openPurchaseDialog: () => {},
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

export function NoopAuthMenuItems(_props: AuthMenuItemsProps) {
  return null;
}
