import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import { IncomingMessage } from "http";
import type {
  InitialElementsMessage,
  SyncStatusMessage,
} from "../../shared/types/excalidraw.js";
import type { AsyncStateManager } from "../managers/types.js";
import { MultiRoomClientManager } from "../managers/MultiRoomClientManager.js";
import { FeedbackService } from "../services/FeedbackService.js";
import { ChatService } from "../services/ChatService.js";
import { IncomingWebSocketMessage, ChatHistoryMessage, UserCommentHistoryMessage } from "../types/websocket.js";

interface WebSocketHandlerDependencies {
  wss: WebSocketServer;
  stateManager: AsyncStateManager;
  clientManager: MultiRoomClientManager;
  feedbackService: FeedbackService;
  chatService: ChatService;
}

export function setupWebSocketHandlers(deps: WebSocketHandlerDependencies): void {
  const { wss, stateManager, clientManager, feedbackService, chatService } = deps;

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    // Extract roomId from path parameter
    const roomId = req.url?.replace(/^\//, "") || "";

    if (!roomId) {
      console.error("WebSocket connection rejected: missing roomId");
      ws.close(1008, "roomId path parameter is required");
      return;
    }

    clientManager.addClient(ws, roomId);

    // Send current elements to new client
    const elements = await stateManager.getElements(roomId);
    const elementsArray = Array.from(elements.values());
    // Strip 'index' property to let Excalidraw regenerate valid fractional indices
    // This avoids InvalidFractionalIndexError when bound elements have invalid index ordering
    const elementsWithoutIndex = elementsArray.map(({ index, ...rest }: any) => rest);
    const initialMessage: InitialElementsMessage = {
      type: "initial_elements",
      elements: elementsWithoutIndex,
    };
    ws.send(JSON.stringify(initialMessage));

    // Send sync status to new client
    const syncMessage: SyncStatusMessage = {
      type: "sync_status",
      elementCount: elements.size,
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(syncMessage));

    // Restore conversation state if exists
    const conversation = await stateManager.getConversation(roomId);
    if (conversation && conversation.messages.length > 0) {
      // Restore latest feedback (only from feedback source, not chat)
      const feedbackMessages = conversation.messages.filter(
        (m) => m.role === "assistant" && m.source === "feedback"
      );
      // Skip if only initial problem statement exists (first feedback message)
      if (feedbackMessages.length > 1) {
        const latestFeedback =
          feedbackMessages[feedbackMessages.length - 1].content;
        const restoreMessage = {
          type: "conversation_restore",
          latestFeedback,
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(restoreMessage));
      }

      // Send chat history (chat messages only, for chat widget display)
      const chatMessages = conversation.messages.filter(
        (m) => m.source === "chat"
      );
      if (chatMessages.length > 0) {
        const chatHistoryMessage: ChatHistoryMessage = {
          type: "chat-history",
          messages: chatMessages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            source: m.source,
          })),
        };
        ws.send(JSON.stringify(chatHistoryMessage));
      }

      // Send user comment history (user role, feedback source only)
      const userFeedbackComments = conversation.messages.filter(
        (m) => m.role === "user" && m.source === "feedback"
      );
      if (userFeedbackComments.length > 0) {
        const userCommentHistoryMessage: UserCommentHistoryMessage = {
          type: "user-comment-history",
          comments: userFeedbackComments.map((m, index) => ({
            stepNumber: index + 1,
            content: m.content,
            timestamp: m.timestamp,
          })),
        };
        ws.send(JSON.stringify(userCommentHistoryMessage));
      }
    }

    ws.on("message", (message: Buffer) => {
      try {
        const data: IncomingWebSocketMessage = JSON.parse(message.toString());

        if (data.type === "get-feedback") {
          feedbackService.handleGetFeedback(ws, roomId, data).catch((error) => {
            console.error(`[WebSocket] Unhandled error in feedbackService for room ${roomId}:`, error);
          });
        } else if (data.type === "chat-message") {
          chatService.handleChatMessage(ws, roomId, data).catch((error) => {
            console.error(`[WebSocket] Unhandled error in chatService for room ${roomId}:`, error);
          });
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      clientManager.removeClient(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      clientManager.removeClient(ws);
    });
  });
}
