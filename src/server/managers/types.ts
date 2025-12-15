import type { ServerElement } from '../../shared/types/excalidraw.js';
import type {
  RoomConversationState,
  ConversationMessage,
  ElementsObject,
} from '../types/conversation.js';

export interface AsyncStateManager {
  // Element operations
  getElements(roomId: string): Promise<Map<string, ServerElement>>;
  getElement(elementId: string, roomId: string): Promise<ServerElement | undefined>;
  setElement(elementId: string, element: ServerElement, roomId: string): Promise<void>;
  deleteElement(elementId: string, roomId: string): Promise<boolean>;
  clearElements(roomId: string): Promise<void>;

  // Room operations
  deleteRoom(roomId: string): Promise<boolean>;
  getRoomCount(): Promise<number>;
  getElementCount(roomId: string): Promise<number>;

  // Conversation operations
  getConversation(roomId: string): Promise<RoomConversationState | undefined>;
  initializeConversation(
    roomId: string,
    problemId: string,
    problemStatement: string
  ): Promise<RoomConversationState>;
  addMessage(roomId: string, message: ConversationMessage): Promise<void>;
  getPreviousElements(roomId: string): Promise<ElementsObject>;
  setPreviousElements(roomId: string, elements: ElementsObject): Promise<void>;
  setCurrentProblemStatement(roomId: string, statement: string): Promise<void>;
  clearConversation(roomId: string): Promise<void>;
}
