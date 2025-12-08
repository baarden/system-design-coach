import type Redis from 'ioredis';
import type { RoomMetadata, RoomRegistry } from './types.js';
import { generateShareToken } from '../utils/tokenUtils.js';

export class RedisRoomRegistry implements RoomRegistry {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private tokenKey(token: string): string {
    return `token:${token}`;
  }

  private roomMetadataKey(roomId: string): string {
    return `room-meta:${roomId}`;
  }

  async getRoomByToken(token: string): Promise<RoomMetadata | null> {
    const json = await this.redis.get(this.tokenKey(token));
    return json ? JSON.parse(json) : null;
  }

  async getTokenByRoom(roomId: string): Promise<string | null> {
    const metadata = await this.getRoomMetadata(roomId);
    return metadata?.shareToken ?? null;
  }

  async createRoom(ownerId: string, problemId: string): Promise<RoomMetadata> {
    const roomId = `${ownerId}/${problemId}`;

    const existing = await this.getRoomMetadata(roomId);
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

    const metadataJson = JSON.stringify(metadata);

    // Atomic creation using Lua script
    const script = `
      local metaKey = KEYS[1]
      local tokenKey = KEYS[2]
      local metadata = ARGV[1]

      if redis.call('EXISTS', metaKey) == 1 then
        return redis.call('GET', metaKey)
      end

      redis.call('SET', metaKey, metadata)
      redis.call('SET', tokenKey, metadata)
      return metadata
    `;

    const result = await this.redis.eval(
      script,
      2,
      this.roomMetadataKey(roomId),
      this.tokenKey(token),
      metadataJson
    );

    return JSON.parse(result as string);
  }

  async regenerateToken(roomId: string, ownerId: string): Promise<string> {
    const newToken = generateShareToken();

    const script = `
      local metaKey = KEYS[1]
      local newTokenKey = KEYS[2]
      local expectedOwner = ARGV[1]
      local newToken = ARGV[2]
      local newTimestamp = ARGV[3]

      local current = redis.call('GET', metaKey)
      if not current then
        return redis.error_reply('Room not found')
      end

      local metadata = cjson.decode(current)
      if metadata.ownerId ~= expectedOwner then
        return redis.error_reply('Only the room owner can regenerate the token')
      end

      local oldTokenKey = 'token:' .. metadata.shareToken
      redis.call('DEL', oldTokenKey)

      metadata.shareToken = newToken
      metadata.tokenCreatedAt = newTimestamp
      local newMetadata = cjson.encode(metadata)

      redis.call('SET', metaKey, newMetadata)
      redis.call('SET', newTokenKey, newMetadata)

      return newToken
    `;

    const result = await this.redis.eval(
      script,
      2,
      this.roomMetadataKey(roomId),
      this.tokenKey(newToken),
      ownerId,
      newToken,
      new Date().toISOString()
    );

    return result as string;
  }

  async roomExists(roomId: string): Promise<boolean> {
    const exists = await this.redis.exists(this.roomMetadataKey(roomId));
    return exists === 1;
  }

  async getRoomMetadata(roomId: string): Promise<RoomMetadata | null> {
    const json = await this.redis.get(this.roomMetadataKey(roomId));
    return json ? JSON.parse(json) : null;
  }
}
