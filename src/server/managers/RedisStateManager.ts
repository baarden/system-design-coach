import type Redis from 'ioredis';
import type { ServerElement } from '../../shared/types/excalidraw.js';
import type {
  RoomConversationState,
  ConversationMessage,
  ElementsObject,
} from '../types/conversation.js';
import type { AsyncStateManager } from './types.js';

export class RedisStateManager implements AsyncStateManager {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private elementsKey(roomId: string): string {
    return `room:${roomId}:elements`;
  }

  private conversationKey(roomId: string): string {
    return `room:${roomId}:conversation`;
  }

  // Element operations

  async getElements(roomId: string): Promise<Map<string, ServerElement>> {
    const key = this.elementsKey(roomId);
    const data = await this.redis.hgetall(key);
    const elements = new Map<string, ServerElement>();
    for (const [id, json] of Object.entries(data)) {
      elements.set(id, JSON.parse(json));
    }
    return elements;
  }

  async getElement(elementId: string, roomId: string): Promise<ServerElement | undefined> {
    const json = await this.redis.hget(this.elementsKey(roomId), elementId);
    return json ? JSON.parse(json) : undefined;
  }

  async setElement(elementId: string, element: ServerElement, roomId: string): Promise<void> {
    const key = this.elementsKey(roomId);
    await this.redis.hset(key, elementId, JSON.stringify(element));
  }

  async deleteElement(elementId: string, roomId: string): Promise<boolean> {
    const result = await this.redis.hdel(this.elementsKey(roomId), elementId);
    return result > 0;
  }

  async clearElements(roomId: string): Promise<void> {
    await this.redis.del(this.elementsKey(roomId));
  }

  // Room operations

  async deleteRoom(roomId: string): Promise<boolean> {
    const results = await this.redis.del(
      this.elementsKey(roomId),
      this.conversationKey(roomId)
    );
    return results > 0;
  }

  async getRoomCount(): Promise<number> {
    const keys = await this.redis.keys('room:*:elements');
    return keys.length;
  }

  async getElementCount(roomId: string): Promise<number> {
    return await this.redis.hlen(this.elementsKey(roomId));
  }

  // Conversation operations

  async getConversation(roomId: string): Promise<RoomConversationState | undefined> {
    const json = await this.redis.get(this.conversationKey(roomId));
    return json ? JSON.parse(json) : undefined;
  }

  async initializeConversation(
    roomId: string,
    problemId: string,
    problemStatement: string
  ): Promise<RoomConversationState> {
    const state: RoomConversationState = {
      messages: [
        {
          role: 'assistant',
          content: problemStatement,
          timestamp: new Date().toISOString(),
          source: 'feedback',
        },
      ],
      previousElements: {},
      problemId,
    };
    await this.redis.set(this.conversationKey(roomId), JSON.stringify(state));
    return state;
  }

  async addMessage(roomId: string, message: ConversationMessage): Promise<void> {
    const key = this.conversationKey(roomId);
    const messageJson = JSON.stringify(message);

    // Lua script for atomic read-modify-write
    const script = `
      local current = redis.call('GET', KEYS[1])
      if not current then
        return redis.error_reply('No conversation state for room')
      end
      local state = cjson.decode(current)
      local message = cjson.decode(ARGV[1])
      table.insert(state.messages, message)
      redis.call('SET', KEYS[1], cjson.encode(state))
      return #state.messages
    `;

    await this.redis.eval(script, 1, key, messageJson);
  }

  async getPreviousElements(roomId: string): Promise<ElementsObject> {
    const state = await this.getConversation(roomId);
    return state?.previousElements ?? {};
  }

  async setPreviousElements(roomId: string, elements: ElementsObject): Promise<void> {
    const key = this.conversationKey(roomId);
    const elementsJson = JSON.stringify(elements);

    // Lua script for atomic read-modify-write
    const script = `
      local current = redis.call('GET', KEYS[1])
      if not current then
        return redis.error_reply('No conversation state for room')
      end
      local state = cjson.decode(current)
      state.previousElements = cjson.decode(ARGV[1])
      redis.call('SET', KEYS[1], cjson.encode(state))
      return 'OK'
    `;

    await this.redis.eval(script, 1, key, elementsJson);
  }

  async setCurrentProblemStatement(roomId: string, statement: string): Promise<void> {
    const key = this.conversationKey(roomId);
    const timestamp = new Date().toISOString();

    // Lua script for atomic read-modify-write
    const script = `
      local current = redis.call('GET', KEYS[1])
      if not current then
        return redis.error_reply('No conversation state for room')
      end
      local state = cjson.decode(current)
      state.currentProblemStatement = ARGV[1]
      -- Append to history
      if not state.problemStatementHistory then
        state.problemStatementHistory = {}
      end
      table.insert(state.problemStatementHistory, { content = ARGV[1], timestamp = ARGV[2] })
      redis.call('SET', KEYS[1], cjson.encode(state))
      return 'OK'
    `;

    await this.redis.eval(script, 1, key, statement, timestamp);
  }

  async clearConversation(roomId: string): Promise<void> {
    await this.redis.del(this.conversationKey(roomId));
  }
}
