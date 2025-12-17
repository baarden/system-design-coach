export interface AuthUser {
  id: string;
}

export interface AuthContextValue {
  isSignedIn: boolean;
  isLoaded: boolean;
  user: AuthUser | null;
  userId: string | null;
  signIn: () => void;
  signOut: () => void;
  reloadUser: () => void;
  onUnavailable: () => void;
  checkAvailability: () => Promise<boolean>;
  openPurchaseDialog: () => void;
}

export interface AuthMenuItemsProps {
  onClose: () => void;
}
