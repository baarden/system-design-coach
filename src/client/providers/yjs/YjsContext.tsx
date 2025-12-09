import { createContext, useContext } from 'react';
import type * as Y from 'yjs';

export interface YjsContextValue {
  /** The Y.Doc instance for this room */
  doc: Y.Doc;
  /** Y.Array for Excalidraw elements */
  yElements: Y.Array<unknown>;
  /** Y.Text for user comments */
  yComments: Y.Text;
  /** Whether the initial sync has completed */
  isSynced: boolean;
  /** Send a Yjs sync message to the server */
  sendSyncMessage: (message: Uint8Array) => void;
  /** Request full state sync from server (call when WebSocket is ready) */
  requestSync: () => void;
}

export const YjsContext = createContext<YjsContextValue | null>(null);

export function useYjs(): YjsContextValue {
  const context = useContext(YjsContext);
  if (!context) {
    throw new Error('useYjs must be used within a YjsProvider');
  }
  return context;
}
