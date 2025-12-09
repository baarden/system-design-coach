import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import QuickLRU from 'quick-lru';
import type WebSocket from 'ws';
import type { ServerElement } from '../../shared/types/excalidraw.js';
import type { MultiRoomClientManager } from './MultiRoomClientManager.js';

// Message types for Yjs sync protocol
const MESSAGE_SYNC = 0;

interface YjsRoomState {
  doc: Y.Doc;
  /** Track which clients have completed initial sync */
  syncedClients: WeakSet<WebSocket>;
  /** The update handler for broadcasting (stored to allow removal) */
  updateHandler?: (update: Uint8Array, origin: unknown) => void;
}

export class YjsDocManager {
  private rooms: QuickLRU<string, YjsRoomState>;
  private clientManager: MultiRoomClientManager;

  constructor(clientManager: MultiRoomClientManager, maxRooms: number = 100) {
    this.rooms = new QuickLRU({ maxSize: maxRooms });
    this.clientManager = clientManager;
  }

  /**
   * Get or create a Y.Doc for a room
   */
  private getOrCreateRoom(roomId: string): YjsRoomState {
    if (!this.rooms.has(roomId)) {
      const doc = new Y.Doc();
      this.rooms.set(roomId, {
        doc,
        syncedClients: new WeakSet(),
      });
    }
    return this.rooms.get(roomId)!;
  }

  /**
   * Get the Y.Doc for a room
   */
  getDoc(roomId: string): Y.Doc {
    return this.getOrCreateRoom(roomId).doc;
  }

  /**
   * Get elements from Y.Doc as ServerElement array
   */
  getElements(roomId: string): ServerElement[] {
    const room = this.getOrCreateRoom(roomId);
    const yElements = room.doc.getArray<ServerElement>('elements');
    return yElements.toArray();
  }

  /**
   * Get elements as a Map keyed by element ID
   */
  getElementsMap(roomId: string): Map<string, ServerElement> {
    const elements = this.getElements(roomId);
    return new Map(elements.map((el) => [el.id, el]));
  }

  /**
   * Get comments text from Y.Doc
   */
  getComments(roomId: string): string {
    const room = this.getOrCreateRoom(roomId);
    const yComments = room.doc.getText('comments');
    return yComments.toString();
  }

  /**
   * Initialize a room's Y.Doc from existing elements (for migration/recovery)
   */
  initializeFromElements(roomId: string, elements: ServerElement[]): void {
    const room = this.getOrCreateRoom(roomId);
    const yElements = room.doc.getArray<ServerElement>('elements');

    // Only initialize if empty
    if (yElements.length === 0 && elements.length > 0) {
      room.doc.transact(() => {
        yElements.push(elements);
      });
    }
  }

  /**
   * Handle initial sync when a client connects
   * Sends SyncStep1 to the client
   */
  handleClientConnect(ws: WebSocket, roomId: string): Uint8Array {
    const room = this.getOrCreateRoom(roomId);

    // Create SyncStep1 message
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, room.doc);

    return encoding.toUint8Array(encoder);
  }

  /**
   * Handle incoming Yjs sync message from a client
   * Returns response message if needed, null otherwise
   */
  handleSyncMessage(
    ws: WebSocket,
    roomId: string,
    payload: Uint8Array
  ): Uint8Array | null {
    const room = this.getOrCreateRoom(roomId);
    const decoder = decoding.createDecoder(payload);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);

      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        room.doc,
        ws // transactionOrigin - used to exclude broadcasting back to sender
      );

      // If this was SyncStep1, mark client as having completed initial sync
      if (syncMessageType === syncProtocol.messageYjsSyncStep1) {
        room.syncedClients.add(ws);
      }

      // If encoder has content, return it as response
      if (encoding.length(encoder) > 1) {
        return encoding.toUint8Array(encoder);
      }
    }

    return null;
  }

  /**
   * Broadcast a Y.Doc update to all clients in a room except the sender
   */
  broadcastUpdate(roomId: string, update: Uint8Array, excludeClient?: WebSocket): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);

    const message = encoding.toUint8Array(encoder);

    // Get all clients in the room and broadcast to all except sender
    const clients = this.clientManager.getClients(roomId);
    for (const client of clients) {
      if (client !== excludeClient && client.readyState === 1) {
        client.send(
          JSON.stringify({
            type: 'yjs-sync',
            payload: Array.from(message),
          })
        );
      }
    }
  }

  /**
   * Set up update listener for a room to broadcast changes
   */
  setupUpdateBroadcasting(roomId: string): void {
    const room = this.getOrCreateRoom(roomId);

    // Only set up once per room
    if (room.updateHandler) {
      return;
    }

    // Create and store the handler
    room.updateHandler = (update: Uint8Array, origin: unknown) => {
      // Exclude the originating client from broadcast (they already have the update)
      const excludeClient = origin instanceof Object && 'readyState' in origin
        ? (origin as WebSocket)
        : undefined;
      this.broadcastUpdate(roomId, update, excludeClient);
    };

    // Add update listener
    room.doc.on('update', room.updateHandler);
  }

  /**
   * Get the full state of a Y.Doc as an update
   */
  getDocState(roomId: string): Uint8Array {
    const room = this.getOrCreateRoom(roomId);
    return Y.encodeStateAsUpdate(room.doc);
  }

  /**
   * Apply an update to a Y.Doc
   */
  applyUpdate(roomId: string, update: Uint8Array, origin?: unknown): void {
    const room = this.getOrCreateRoom(roomId);
    Y.applyUpdate(room.doc, update, origin);
  }

  /**
   * Delete a room and its Y.Doc
   */
  deleteRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (room) {
      room.doc.destroy();
      return this.rooms.delete(roomId);
    }
    return false;
  }

  /**
   * Get the number of rooms
   */
  getRoomCount(): number {
    return this.rooms.size;
  }
}
