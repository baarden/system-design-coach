import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import { IncomingMessage } from "http";
import type {
  InitialElementsMessage,
  SyncStatusMessage,
} from "../../shared/types/excalidraw.js";
import type { AsyncStateManager } from "../managers/types.js";
import type { RoomRegistry } from "../registries/types.js";
import { MultiRoomClientManager } from "../managers/MultiRoomClientManager.js";
import { YjsDocManager } from "../managers/YjsDocManager.js";
import { FeedbackService } from "../services/FeedbackService.js";
import { ChatService } from "../services/ChatService.js";
import { IncomingWebSocketMessage, ChatHistoryMessage, UserCommentHistoryMessage } from "../types/websocket.js";
import { logger } from "../utils/logger.js";

interface WebSocketHandlerDependencies {
  wss: WebSocketServer;
  stateManager: AsyncStateManager;
  clientManager: MultiRoomClientManager;
  yjsDocManager: YjsDocManager;
  feedbackService: FeedbackService;
  chatService: ChatService;
  roomRegistry: RoomRegistry;
}

type AccessMode = 'owner' | 'guest';

interface ParsedConnection {
  roomId: string;
  accessMode: AccessMode;
  userId: string | null;
}

async function parseWebSocketUrl(
  url: string,
  roomRegistry: RoomRegistry
): Promise<ParsedConnection | null> {
  const cleanUrl = url.replace(/^\//, '');

  // Pattern: ws/owner/:user/:problemId
  const ownerMatch = cleanUrl.match(/^ws\/owner\/([^/]+)\/([^/]+)$/);
  if (ownerMatch) {
    const [, user, problemId] = ownerMatch;
    const roomId = `${user}/${problemId}`;

    // User is identified by URL path - create room if needed
    let metadata = await roomRegistry.getRoomMetadata(roomId);
    if (!metadata) {
      metadata = await roomRegistry.createRoom(user, problemId);
    }

    return { roomId, accessMode: 'owner', userId: user };
  }

  // Pattern: ws/guest/:token
  const guestMatch = cleanUrl.match(/^ws\/guest\/([^/]+)$/);
  if (guestMatch) {
    const [, token] = guestMatch;
    const metadata = await roomRegistry.getRoomByToken(token);
    if (!metadata) {
      return null;
    }
    return { roomId: metadata.roomId, accessMode: 'guest', userId: null };
  }

  return null;
}

export function setupWebSocketHandlers(deps: WebSocketHandlerDependencies): void {
  const { wss, stateManager, clientManager, yjsDocManager, feedbackService, chatService, roomRegistry } = deps;

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const parsed = await parseWebSocketUrl(req.url || '', roomRegistry);

    if (!parsed) {
      logger.warn("WebSocket connection rejected", { reason: "invalid URL or unauthorized" });
      ws.close(1008, "Invalid room URL or unauthorized");
      return;
    }

    const { roomId, accessMode, userId } = parsed;
    (ws as any).accessMode = accessMode;
    (ws as any).roomId = roomId;
    (ws as any).userId = userId;

    clientManager.addClient(ws, roomId);

    // Set up Yjs update broadcasting for this room
    yjsDocManager.setupUpdateBroadcasting(roomId);

    // Get elements from Redis and initialize Y.Doc if empty (for persistence recovery)
    const elements = await stateManager.getElements(roomId);
    const elementsArray = Array.from(elements.values());
    yjsDocManager.initializeFromElements(roomId, elementsArray);

    // Send initial Yjs sync (SyncStep1) to new client
    const yjsSyncStep1 = yjsDocManager.handleClientConnect(ws, roomId);
    ws.send(JSON.stringify({
      type: 'yjs-sync',
      payload: Array.from(yjsSyncStep1),
    }));

    // Send current elements to new client (for backwards compatibility)
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
      if (feedbackMessages.length > 1 || conversation.currentProblemStatement) {
        const latestFeedback =
          feedbackMessages.length > 1
            ? feedbackMessages[feedbackMessages.length - 1].content
            : undefined;
        const restoreMessage = {
          type: "conversation_restore",
          latestFeedback,
          currentProblemStatement: conversation.currentProblemStatement,
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

        if (data.type === "yjs-sync") {
          // Yjs sync messages - allowed for both owners and guests (collaborative editing)
          const payload = new Uint8Array(data.payload);
          const response = yjsDocManager.handleSyncMessage(ws, roomId, payload);
          if (response) {
            ws.send(JSON.stringify({
              type: 'yjs-sync',
              payload: Array.from(response),
            }));
          }
        } else if (data.type === "get-feedback") {
          if (accessMode === 'guest') {
            ws.send(JSON.stringify({ type: "status", eventId: data.eventId, status: "error", message: "Guests cannot request feedback" }));
            return;
          }
          feedbackService.handleGetFeedback(ws, roomId, data, userId!).catch((error) => {
            logger.error("Unhandled error in feedbackService", { roomId, error: (error as Error).message });
          });
        } else if (data.type === "chat-message") {
          if (accessMode === 'guest') {
            ws.send(JSON.stringify({ type: "status", eventId: data.eventId, status: "error", message: "Guests cannot send chat messages" }));
            return;
          }
          chatService.handleChatMessage(ws, roomId, data, userId!).catch((error) => {
            logger.error("Unhandled error in chatService", { roomId, error: (error as Error).message });
          });
        }
      } catch (error) {
        logger.error("Error processing WebSocket message", { error: (error as Error).message });
      }
    });

    ws.on("close", () => {
      clientManager.removeClient(ws);
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error", { error: (error as Error).message });
      clientManager.removeClient(ws);
    });
  });
}
