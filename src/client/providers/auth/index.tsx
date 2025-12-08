import type { ReactNode } from 'react';
import { NoopAuthProvider, NoopAuthUI } from './NoopAuthProvider';

export { useAuth } from './AuthContext';
export type { AuthUser, AuthContextValue } from './types';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <NoopAuthProvider>{children}</NoopAuthProvider>;
}

export function AuthUI() {
  return <NoopAuthUI />;
}
