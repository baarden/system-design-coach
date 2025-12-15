import { useCallback, MutableRefObject } from "react";
import type {
  StatusMessage,
  ClaudeFeedbackMessage,
  NextPromptMessage,
  ConversationRestoreMessage,
  OutgoingWebSocketMessage,
  UserCommentHistoryMessage,
  UserCommentHistoryItem,
  ClaudeFeedbackHistoryMessage,
  ClaudeFeedbackHistoryItem,
  ProblemStatementHistoryMessage,
  ProblemStatementHistoryItem,
} from "@shared/types/websocket";

/** Error message type for generic errors (e.g., payment-error) */
interface ErrorMessage {
  type: string;
  message: string;
}

type WebSocketMessage = OutgoingWebSocketMessage | ErrorMessage;

/**
 * Callbacks for handling different message types
 */
interface MessageHandlers {
  onChatMessage: (data: unknown) => void;
  onClaudeFeedback: (feedback: string) => void;
  onNextPrompt: (prompt: string) => void;
  onFeedbackComplete: () => void;
  onFeedbackError: (message: string, needsCredits?: boolean) => void;
  onError: (message: string) => void;
  onUserCommentsReset: () => void;
  onUserCommentHistory: (comments: UserCommentHistoryItem[]) => void;
  onClaudeFeedbackHistory: (feedbackItems: ClaudeFeedbackHistoryItem[]) => void;
  onProblemStatementHistory: (statements: ProblemStatementHistoryItem[]) => void;
  reloadUser: () => void;
}

interface UseWebSocketMessagesOptions {
  pendingEventIdRef: MutableRefObject<string | null>;
  handlers: MessageHandlers;
}

/**
 * Hook to handle WebSocket message routing from ExcalidrawClient.
 * Routes messages to appropriate handlers based on message type.
 */
export function useWebSocketMessages({
  pendingEventIdRef,
  handlers,
}: UseWebSocketMessagesOptions) {
  const handleWebSocketMessage = useCallback(
    (message: unknown) => {
      const data = message as WebSocketMessage;

      // Forward chat-related messages to ChatWidget via callback
      if (
        data.type === "chat-history" ||
        data.type === "chat-response" ||
        (data.type === "status" && (data as StatusMessage).eventId?.startsWith("chat-"))
      ) {
        handlers.onChatMessage(data);

        // Don't return early for status messages - they might also be for feedback
        if (data.type !== "status") {
          return;
        }
      }

      // Handle conversation restore on reconnect
      if (data.type === "conversation_restore") {
        const restoreMsg = data as ConversationRestoreMessage;
        if (restoreMsg.latestFeedback) {
          handlers.onClaudeFeedback(restoreMsg.latestFeedback);
        }
        if (restoreMsg.currentProblemStatement) {
          handlers.onNextPrompt(restoreMsg.currentProblemStatement);
        }
        return;
      }

      // Handle user comment history on reconnect
      if (data.type === "user-comment-history") {
        const historyMsg = data as UserCommentHistoryMessage;
        handlers.onUserCommentHistory(historyMsg.comments);
        return;
      }

      // Handle claude feedback history on reconnect
      if (data.type === "claude-feedback-history") {
        const historyMsg = data as ClaudeFeedbackHistoryMessage;
        handlers.onClaudeFeedbackHistory(historyMsg.feedbackItems);
        return;
      }

      // Handle problem statement history on reconnect
      if (data.type === "problem-statement-history") {
        const historyMsg = data as ProblemStatementHistoryMessage;
        handlers.onProblemStatementHistory(historyMsg.statements);
        return;
      }

      // Handle claude-feedback messages
      if (data.type === "claude-feedback") {
        const feedbackMsg = data as ClaudeFeedbackMessage;
        handlers.onClaudeFeedback(feedbackMsg.responseText);
        handlers.onUserCommentsReset();
      }

      // Handle next-prompt messages
      if (data.type === "next-prompt") {
        const promptMsg = data as NextPromptMessage;
        if (promptMsg.nextPrompt) {
          handlers.onNextPrompt(promptMsg.nextPrompt);
        }
      }

      // Handle status messages for feedback requests
      if (data.type === "status") {
        const statusMsg = data as StatusMessage;
        if (statusMsg.eventId === pendingEventIdRef.current) {
          if (statusMsg.status === "completed") {
            handlers.onFeedbackComplete();
            pendingEventIdRef.current = null;
          } else if (statusMsg.status === "error") {
            handlers.onFeedbackError(
              statusMsg.message || "An error occurred while getting feedback",
              statusMsg.needsCredits
            );
            pendingEventIdRef.current = null;
          }
        }
      }

      // Handle any error messages (e.g., payment-error)
      if (data.type?.endsWith("-error")) {
        const errorMsg = data as ErrorMessage;
        if (errorMsg.message) {
          handlers.onError(errorMsg.message);
          handlers.reloadUser();
        }
      }

      // Dispatch all messages as DOM events for extensibility
      window.dispatchEvent(new CustomEvent(`ws:${data.type}`, { detail: data }));
    },
    [pendingEventIdRef, handlers]
  );

  return { handleWebSocketMessage };
}
