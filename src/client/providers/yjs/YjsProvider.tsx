import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { YjsContext, type YjsContextValue } from './YjsContext';

const MESSAGE_SYNC = 0;

interface YjsProviderProps {
  children: ReactNode;
  /** WebSocket send function */
  sendMessage: (message: unknown) => void;
  /** Called when an incoming yjs-sync message is received */
  onYjsMessage?: (handler: (payload: number[]) => void) => void;
}

export function YjsProvider({ children, sendMessage, onYjsMessage }: YjsProviderProps) {
  const [isSynced, setIsSynced] = useState(false);

  // Create stable Y.Doc instance
  const doc = useMemo(() => new Y.Doc(), []);
  const yElements = useMemo(() => doc.getArray<unknown>('elements'), [doc]);
  const yComments = useMemo(() => doc.getText('comments'), [doc]);

  // Send sync message to server
  const sendSyncMessage = useCallback(
    (message: Uint8Array) => {
      sendMessage({
        type: 'yjs-sync',
        payload: Array.from(message),
      });
    },
    [sendMessage]
  );

  // Set up document update listener to broadcast changes
  useEffect(() => {
    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      // Don't re-broadcast updates that came from the server
      if (origin === 'remote') return;

      // Encode and send the update
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      sendSyncMessage(encoding.toUint8Array(encoder));
    };

    doc.on('update', handleUpdate);
    return () => {
      doc.off('update', handleUpdate);
    };
  }, [doc, sendSyncMessage]);

  // Register Yjs message handler
  useEffect(() => {
    if (!onYjsMessage) return;

    const handler = (payload: number[]) => {
      handleYjsSyncMessage(doc, payload, sendSyncMessage, () => setIsSynced(true));
    };

    onYjsMessage(handler);
  }, [doc, sendSyncMessage, onYjsMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      doc.destroy();
    };
  }, [doc]);

  // Request full state sync from server (send SyncStep1)
  const requestSync = useCallback(() => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    sendSyncMessage(encoding.toUint8Array(encoder));
  }, [doc, sendSyncMessage]);

  const contextValue: YjsContextValue = useMemo(
    () => ({
      doc,
      yElements,
      yComments,
      isSynced,
      sendSyncMessage,
      requestSync,
    }),
    [doc, yElements, yComments, isSynced, sendSyncMessage, requestSync]
  );

  return <YjsContext.Provider value={contextValue}>{children}</YjsContext.Provider>;
}

/**
 * Handle an incoming yjs-sync message from the server.
 * Call this from the parent component's WebSocket message handler.
 */
export function handleYjsSyncMessage(
  doc: Y.Doc,
  payload: number[],
  sendSyncMessage: (message: Uint8Array) => void,
  onSynced?: () => void
): void {
  const data = new Uint8Array(payload);
  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);

  if (messageType === MESSAGE_SYNC) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);

    const syncMessageType = syncProtocol.readSyncMessage(
      decoder,
      encoder,
      doc,
      'remote' // origin - marks this as a remote update
    );

    // SyncStep2 means the server has sent us its state
    if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
      onSynced?.();
    }

    // If the encoder has content (a response), send it
    if (encoding.length(encoder) > 1) {
      sendSyncMessage(encoding.toUint8Array(encoder));
    }
  }
}

/**
 * Hook to create a Yjs sync message handler
 */
export function useYjsSyncHandler(
  doc: Y.Doc | null,
  sendSyncMessage: ((message: Uint8Array) => void) | null,
  onSynced?: () => void
) {
  return useCallback(
    (payload: number[]) => {
      if (doc && sendSyncMessage) {
        handleYjsSyncMessage(doc, payload, sendSyncMessage, onSynced);
      }
    },
    [doc, sendSyncMessage, onSynced]
  );
}
