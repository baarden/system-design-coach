import QuickLRU from 'quick-lru';
import type { ServerElement } from '../../shared/types/excalidraw.js';
import type {
  RoomConversationState,
  ConversationMessage,
  ElementsObject,
} from '../types/conversation.js';
import type { AsyncStateManager } from './types.js';

export class MultiRoomStateManager implements AsyncStateManager {
  private rooms: QuickLRU<string, Map<string, ServerElement>>;
  private conversations: QuickLRU<string, RoomConversationState>;

  constructor(maxRooms: number = 100) {
    this.rooms = new QuickLRU({ maxSize: maxRooms });
    this.conversations = new QuickLRU({ maxSize: maxRooms });
  }

  private getOrCreateRoom(roomId: string): Map<string, ServerElement> {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    return this.rooms.get(roomId)!;
  }

  async getElements(roomId: string): Promise<Map<string, ServerElement>> {
    return this.getOrCreateRoom(roomId);
  }

  async getElement(elementId: string, roomId: string): Promise<ServerElement | undefined> {
    return this.getOrCreateRoom(roomId).get(elementId);
  }

  async setElement(elementId: string, element: ServerElement, roomId: string): Promise<void> {
    this.getOrCreateRoom(roomId).set(elementId, element);
  }

  async deleteElement(elementId: string, roomId: string): Promise<boolean> {
    const room = this.getOrCreateRoom(roomId);
    return room.delete(elementId);
  }

  async clearElements(roomId: string): Promise<void> {
    this.getOrCreateRoom(roomId).clear();
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    const existed = this.rooms.has(roomId);
    this.rooms.delete(roomId);
    this.conversations.delete(roomId);
    return existed;
  }

  async getRoomCount(): Promise<number> {
    return this.rooms.size;
  }

  async getElementCount(roomId: string): Promise<number> {
    return this.getOrCreateRoom(roomId).size;
  }

  // Conversation state methods

  async getConversation(roomId: string): Promise<RoomConversationState | undefined> {
    return this.conversations.get(roomId);
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
    this.conversations.set(roomId, state);
    return state;
  }

  async addMessage(roomId: string, message: ConversationMessage): Promise<void> {
    const state = this.conversations.get(roomId);
    if (!state) {
      throw new Error(`No conversation state for room: ${roomId}`);
    }
    state.messages.push(message);
  }

  async getPreviousElements(roomId: string): Promise<ElementsObject> {
    const state = this.conversations.get(roomId);
    return state?.previousElements ?? {};
  }

  async setPreviousElements(roomId: string, elements: ElementsObject): Promise<void> {
    const state = this.conversations.get(roomId);
    if (!state) {
      throw new Error(`No conversation state for room: ${roomId}`);
    }
    state.previousElements = elements;
  }

  async setCurrentProblemStatement(roomId: string, statement: string): Promise<void> {
    const state = this.conversations.get(roomId);
    if (!state) {
      throw new Error(`No conversation state for room: ${roomId}`);
    }
    state.currentProblemStatement = statement;
    // Append to history
    if (!state.problemStatementHistory) {
      state.problemStatementHistory = [];
    }
    state.problemStatementHistory.push({
      content: statement,
      timestamp: new Date().toISOString(),
    });
  }

  async clearConversation(roomId: string): Promise<void> {
    this.conversations.delete(roomId);
  }
}
