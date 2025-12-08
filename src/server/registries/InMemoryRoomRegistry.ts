import QuickLRU from 'quick-lru';
import type { RoomMetadata, RoomRegistry } from './types.js';
import { generateShareToken } from '../utils/tokenUtils.js';

export class InMemoryRoomRegistry implements RoomRegistry {
  private roomsByToken: QuickLRU<string, RoomMetadata>;
  private tokensByRoom: QuickLRU<string, string>;
  private roomMetadata: QuickLRU<string, RoomMetadata>;

  constructor(maxRooms: number = 100) {
    this.roomsByToken = new QuickLRU({ maxSize: maxRooms });
    this.tokensByRoom = new QuickLRU({ maxSize: maxRooms });
    this.roomMetadata = new QuickLRU({ maxSize: maxRooms });
  }

  async getRoomByToken(token: string): Promise<RoomMetadata | null> {
    return this.roomsByToken.get(token) ?? null;
  }

  async getTokenByRoom(roomId: string): Promise<string | null> {
    return this.tokensByRoom.get(roomId) ?? null;
  }

  async createRoom(ownerId: string, problemId: string): Promise<RoomMetadata> {
    const roomId = `${ownerId}/${problemId}`;

    const existing = this.roomMetadata.get(roomId);
    if (existing) {
      return existing;
    }

    const token = generateShareToken();
    const now = new Date().toISOString();

    const metadata: RoomMetadata = {
      roomId,
      ownerId,
      problemId,
      shareToken: token,
      createdAt: now,
      tokenCreatedAt: now,
    };

    this.roomMetadata.set(roomId, metadata);
    this.roomsByToken.set(token, metadata);
    this.tokensByRoom.set(roomId, token);

    return metadata;
  }

  async regenerateToken(roomId: string, ownerId: string): Promise<string> {
    const existing = this.roomMetadata.get(roomId);
    if (!existing) {
      throw new Error(`Room not found: ${roomId}`);
    }
    if (existing.ownerId !== ownerId) {
      throw new Error('Only the room owner can regenerate the token');
    }

    const oldToken = this.tokensByRoom.get(roomId);
    if (oldToken) {
      this.roomsByToken.delete(oldToken);
    }

    const newToken = generateShareToken();
    const updatedMetadata: RoomMetadata = {
      ...existing,
      shareToken: newToken,
      tokenCreatedAt: new Date().toISOString(),
    };

    this.roomMetadata.set(roomId, updatedMetadata);
    this.roomsByToken.set(newToken, updatedMetadata);
    this.tokensByRoom.set(roomId, newToken);

    return newToken;
  }

  async roomExists(roomId: string): Promise<boolean> {
    return this.roomMetadata.has(roomId);
  }

  async getRoomMetadata(roomId: string): Promise<RoomMetadata | null> {
    return this.roomMetadata.get(roomId) ?? null;
  }
}
