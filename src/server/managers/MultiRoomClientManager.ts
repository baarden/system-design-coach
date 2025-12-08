import type { WebSocket } from 'ws';
import type { ClientManager, ExcalidrawMessage } from '../../shared/types/excalidraw.js';

export class MultiRoomClientManager implements ClientManager {
  private roomClients: Map<string, Set<WebSocket>>;
  private clientRooms: Map<WebSocket, string>;

  constructor() {
    this.roomClients = new Map();
    this.clientRooms = new Map();
  }

  addClient(ws: WebSocket, roomId?: string): void {
    if (!roomId) {
      throw new Error('roomId is required for MultiRoomClientManager');
    }

    // Remove client from previous room if exists
    this.removeClient(ws);

    // Add to new room
    if (!this.roomClients.has(roomId)) {
      this.roomClients.set(roomId, new Set());
    }

    this.roomClients.get(roomId)!.add(ws);
    this.clientRooms.set(ws, roomId);
  }

  removeClient(ws: WebSocket): void {
    const roomId = this.clientRooms.get(ws);
    if (!roomId) {
      return;
    }

    const clients = this.roomClients.get(roomId);
    if (clients) {
      clients.delete(ws);

      // Auto-cleanup empty rooms
      if (clients.size === 0) {
        this.roomClients.delete(roomId);
      }
    }

    this.clientRooms.delete(ws);
  }

  getClients(roomId?: string): Set<WebSocket> {
    if (!roomId) {
      throw new Error('roomId is required for MultiRoomClientManager');
    }
    return this.roomClients.get(roomId) || new Set();
  }

  getRoomForClient(ws: WebSocket): string | undefined {
    return this.clientRooms.get(ws);
  }

  broadcast(message: ExcalidrawMessage, roomId?: string, excludeClient?: WebSocket): void {
    if (!roomId) {
      throw new Error('roomId is required for MultiRoomClientManager');
    }

    const clients = this.getClients(roomId);
    const messageStr = JSON.stringify(message);

    clients.forEach((client) => {
      if (client !== excludeClient && client.readyState === 1) {
        client.send(messageStr);
      }
    });
  }

  // Additional utility methods
  getRoomCount(): number {
    return this.roomClients.size;
  }

  getClientCount(roomId: string): number {
    return this.roomClients.get(roomId)?.size || 0;
  }

  getAllRooms(): string[] {
    return Array.from(this.roomClients.keys());
  }

  /**
   * Broadcast a message to all connections for a specific user.
   * Matches rooms that:
   * - Start with `${userId}/` (user in a design room)
   * - Equal `user/${userId}` (user on landing page)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  broadcastToUser(userId: string, message: { type: string; [key: string]: any }): void {
    const messageStr = JSON.stringify(message);
    const userRoomPrefix = `${userId}/`;
    const userLandingRoom = `user/${userId}`;

    for (const [roomId, clients] of this.roomClients.entries()) {
      if (roomId.startsWith(userRoomPrefix) || roomId === userLandingRoom) {
        clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(messageStr);
          }
        });
      }
    }
  }
}
