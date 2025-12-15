/**
 * Shared WebSocket message types for client-server communication.
 * These types are the single source of truth for both client and server.
 */

// ============================================
// Incoming Messages (Client → Server)
// ============================================

export interface GetFeedbackMessage {
  type: "get-feedback";
  eventId: string;
  userComments: string;
  userId: string;
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

export type IncomingWebSocketMessage = GetFeedbackMessage | ChatMessage | YjsSyncMessage;

// ============================================
// Outgoing Messages (Server → Client)
// ============================================

export interface StatusMessage {
  type: "status";
  eventId: string;
  status: "completed" | "error";
  message?: string;
  needsCredits?: boolean;
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
  currentProblemStatement?: string;
  timestamp: string;
}

export interface ChatResponseMessage {
  type: "chat-response";
  message: string;
  timestamp: string;
}

export interface ChatHistoryMessageItem {
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  source: "chat" | "feedback";
}

export interface ChatHistoryMessage {
  type: "chat-history";
  messages: ChatHistoryMessageItem[];
}

export interface ElementsBatchCreatedMessage {
  type: "elements_batch_created";
  elements: unknown[]; // ServerElement from excalidraw types
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

export interface ClaudeFeedbackHistoryItem {
  stepNumber: number;
  content: string;
  timestamp: string;
}

export interface ClaudeFeedbackHistoryMessage {
  type: "claude-feedback-history";
  feedbackItems: ClaudeFeedbackHistoryItem[];
}

export interface ProblemStatementHistoryItem {
  stepNumber: number;
  content: string;
  timestamp: string;
}

export interface ProblemStatementHistoryMessage {
  type: "problem-statement-history";
  statements: ProblemStatementHistoryItem[];
}

export interface YjsSyncBroadcast {
  type: "yjs-sync";
  /** Binary Yjs update encoded as number array */
  payload: number[];
}

export type OutgoingWebSocketMessage =
  | StatusMessage
  | ClaudeFeedbackMessage
  | NextPromptMessage
  | ConversationRestoreMessage
  | ChatResponseMessage
  | ChatHistoryMessage
  | ElementsBatchCreatedMessage
  | UserCommentHistoryMessage
  | ClaudeFeedbackHistoryMessage
  | ProblemStatementHistoryMessage
  | YjsSyncBroadcast;

// ============================================
// Utility Types
// ============================================

/** All WebSocket message types */
export type WebSocketMessage = IncomingWebSocketMessage | OutgoingWebSocketMessage;

/** Extract message type by discriminant */
export type MessageByType<T extends WebSocketMessage["type"]> = Extract<
  WebSocketMessage,
  { type: T }
>;
