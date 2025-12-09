import type { ServerElement } from "../../shared/types/excalidraw.js";

// WebSocket message types for feedback feature

export interface GetFeedbackMessage {
  type: "get-feedback";
  eventId: string;
  userComments: string;
  userId: string;
}

export interface StatusMessage {
  type: "status";
  eventId: string;
  status: "completed" | "error";
  message?: string;
  needsCredits?: boolean;
}

export interface DiagramChange {
  objectId: string;
  number: number;
}

export interface ClaudeFeedbackMessage {
  type: "claude-feedback";
  responseText: string;
  timestamp: string;
}

export interface NextPromptMessage {
  type: "next-prompt";
  nextPrompt: string;
  timestamp: string;
}

export interface ConversationRestoreMessage {
  type: "conversation_restore";
  latestFeedback: string;
  timestamp: string;
}

export interface ChatMessage {
  type: "chat-message";
  eventId: string;
  message: string;
  userId: string;
}

export interface YjsSyncMessage {
  type: "yjs-sync";
  /** Binary Yjs update encoded as number array */
  payload: number[];
}

export interface ChatResponseMessage {
  type: "chat-response";
  message: string;
  timestamp: string;
}

export interface ChatHistoryMessage {
  type: "chat-history";
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
    source: string;
  }>;
}

export interface ElementsBatchCreatedMessage {
  type: "elements_batch_created";
  elements: ServerElement[];
  timestamp: string;
}

export interface UserCommentHistoryItem {
  stepNumber: number;
  content: string;
  timestamp: string;
}

export interface UserCommentHistoryMessage {
  type: "user-comment-history";
  comments: UserCommentHistoryItem[];
}

export type IncomingWebSocketMessage = GetFeedbackMessage | ChatMessage | YjsSyncMessage;

export type OutgoingWebSocketMessage =
  | StatusMessage
  | ClaudeFeedbackMessage
  | NextPromptMessage
  | ConversationRestoreMessage
  | ChatResponseMessage
  | ChatHistoryMessage
  | ElementsBatchCreatedMessage
  | UserCommentHistoryMessage;
