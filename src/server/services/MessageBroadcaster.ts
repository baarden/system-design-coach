import type WebSocket from "ws";
import type { MultiRoomClientManager } from "../managers/MultiRoomClientManager.js";
import type { OutgoingWebSocketMessage } from "../types/websocket.js";

/**
 * Interface for broadcasting messages to WebSocket clients.
 * Abstracts the client manager to enable testing without real WebSocket connections.
 */
export interface MessageBroadcaster {
  broadcast(message: OutgoingWebSocketMessage, roomId: string, excludeClient?: WebSocket): void;
}

/**
 * Implementation that wraps MultiRoomClientManager.
 */
export class ClientManagerBroadcaster implements MessageBroadcaster {
  constructor(private clientManager: MultiRoomClientManager) {}

  broadcast(message: OutgoingWebSocketMessage, roomId: string, excludeClient?: WebSocket): void {
    // Cast to any here since the external library's WebSocketMessage type
    // doesn't include our custom message types
    this.clientManager.broadcast(message as any, roomId, excludeClient);
  }
}
