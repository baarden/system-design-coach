import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import type { IncomingMessage } from "http";
import { setupWebSocketHandlers, stripDiagramChanges } from "./websocketHandler.js";
import { MultiRoomStateManager } from "../managers/MultiRoomStateManager.js";
import { MultiRoomClientManager } from "../managers/MultiRoomClientManager.js";
import { YjsDocManager } from "../managers/YjsDocManager.js";
import { InMemoryRoomRegistry } from "../registries/InMemoryRoomRegistry.js";
import { FeedbackService } from "../services/FeedbackService.js";
import { ChatService } from "../services/ChatService.js";
import { createTestProblemRepository } from "../repositories/ProblemRepository.js";
import type { AIClient } from "../services/ai/types.js";
import type { UsageProvider } from "../providers/usage/types.js";
import { logger } from "../utils/logger.js";

// Mock logger
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock WebSocket
function createMockWebSocket(): WebSocket {
  const listeners: Record<string, Function[]> = {};
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    emit: (event: string, ...args: any[]) => {
      listeners[event]?.forEach((h) => h(...args));
    },
  } as unknown as WebSocket & { emit: Function };
}

// Mock WebSocketServer
function createMockWSS(): WebSocketServer {
  const listeners: Record<string, Function[]> = {};
  return {
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    emit: (event: string, ...args: any[]) => {
      listeners[event]?.forEach((h) => h(...args));
    },
  } as unknown as WebSocketServer & { emit: Function };
}

// Mock IncomingMessage
function createMockRequest(url: string, headers: Record<string, string> = {}): IncomingMessage {
  return { url, headers } as unknown as IncomingMessage;
}

const testProblems = [
  {
    id: "url-shortener",
    category: "Web",
    title: "URL Shortener",
    description: "Design a URL shortening service",
    statement: "Design a URL shortening service like bit.ly",
  },
];

describe("websocketHandler", () => {
  let wss: WebSocketServer & { emit: Function };
  let stateManager: MultiRoomStateManager;
  let clientManager: MultiRoomClientManager;
  let yjsDocManager: YjsDocManager;
  let feedbackService: FeedbackService;
  let chatService: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();

    wss = createMockWSS();
    stateManager = new MultiRoomStateManager();
    clientManager = new MultiRoomClientManager();
    yjsDocManager = new YjsDocManager(clientManager);

    const mockAIClient: AIClient = {
      createMessage: vi.fn().mockResolvedValue({
        content: [
          {
            type: "tool_use",
            id: "1",
            name: "give_system_design_feedback",
            input: { feedback: "Test feedback" },
          },
        ],
        usage: { inputTokens: 10, outputTokens: 5 },
      }),
    };

    const mockUsageProvider: UsageProvider = {
      checkAvailability: vi.fn().mockResolvedValue(null),
      recordUsage: vi.fn(),
    };

    feedbackService = new FeedbackService({
      aiClient: mockAIClient,
      stateManager,
      broadcaster: { broadcast: vi.fn() },
      usageProvider: mockUsageProvider,
      problemRepository: createTestProblemRepository(testProblems),
    });

    chatService = new ChatService({
      aiClient: {
        createMessage: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Test response" }],
          usage: { inputTokens: 10, outputTokens: 5 },
        }),
      },
      stateManager,
      usageProvider: mockUsageProvider,
      problemRepository: createTestProblemRepository(testProblems),
    });

    const roomRegistry = new InMemoryRoomRegistry();
    setupWebSocketHandlers({
      wss,
      stateManager,
      clientManager,
      yjsDocManager,
      feedbackService,
      chatService,
      roomRegistry,
    });
  });

  describe("connection handling", () => {
    it("registers connection handler", () => {
      expect(wss.on).toHaveBeenCalledWith("connection", expect.any(Function));
    });

    it("adds client to manager on connection", async () => {
      const ws = createMockWebSocket();
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      wss.emit("connection", ws, req);
      // Wait for async handler
      await new Promise((r) => setTimeout(r, 10));

      expect(clientManager.getRoomForClient(ws)).toBe("user123/url-shortener");
    });

    it("closes connection if roomId is missing", async () => {
      const ws = createMockWebSocket();
      const req = createMockRequest("/invalid-url", {});

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));

      // Verify connection is rejected with correct code and message
      expect(ws.close).toHaveBeenCalledWith(
        1008,
        "Invalid room URL or unauthorized"
      );

      // Verify rejection is logged for monitoring
      expect(logger.warn).toHaveBeenCalledWith(
        "WebSocket connection rejected",
        { reason: "invalid URL or unauthorized" }
      );
    });

    it("sends initial elements to new client", async () => {
      const ws = createMockWebSocket();
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      // Add element to room
      await stateManager.setElement(
        "elem1",
        { id: "elem1", type: "rectangle" } as any,
        "user123/url-shortener"
      );

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"initial_elements"')
      );
    });

    it("sends sync status to new client", async () => {
      const ws = createMockWebSocket();
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"sync_status"')
      );
    });

    it("restores conversation state on reconnect", async () => {
      // Set up existing conversation with feedback
      await stateManager.initializeConversation(
        "user123/url-shortener",
        "url-shortener",
        "Initial statement"
      );
      await stateManager.addMessage("user123/url-shortener", {
        role: "assistant",
        content: "Previous feedback",
        timestamp: new Date().toISOString(),
        source: "feedback",
      });

      const ws = createMockWebSocket();
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"conversation_restore"')
      );
    });

    it("sends chat history on reconnect", async () => {
      // Set up existing conversation with chat messages
      await stateManager.initializeConversation(
        "user123/url-shortener",
        "url-shortener",
        "Initial statement"
      );
      await stateManager.addMessage("user123/url-shortener", {
        role: "user",
        content: "Chat message",
        timestamp: new Date().toISOString(),
        source: "chat",
      });

      const ws = createMockWebSocket();
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"chat-history"')
      );
    });
  });

  describe("message handling", () => {
    it("routes get-feedback messages to FeedbackService", async () => {
      const ws = createMockWebSocket() as WebSocket & { emit: Function };
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      vi.spyOn(feedbackService, "handleGetFeedback").mockResolvedValue();

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));

      const message = JSON.stringify({
        type: "get-feedback",
        eventId: "event1",
        userComments: "Test",
        userId: "user123",
      });
      ws.emit("message", Buffer.from(message));

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 20));

      expect(feedbackService.handleGetFeedback).toHaveBeenCalledWith(
        ws,
        "user123/url-shortener",
        expect.objectContaining({ type: "get-feedback" }),
        "user123"
      );
    });

    it("routes chat-message messages to ChatService", async () => {
      const ws = createMockWebSocket() as WebSocket & { emit: Function };
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      vi.spyOn(chatService, "handleChatMessage").mockResolvedValue();

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));

      const message = JSON.stringify({
        type: "chat-message",
        eventId: "event1",
        message: "Hello",
        userId: "user123",
      });
      ws.emit("message", Buffer.from(message));

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 20));

      expect(chatService.handleChatMessage).toHaveBeenCalledWith(
        ws,
        "user123/url-shortener",
        expect.objectContaining({ type: "chat-message" }),
        "user123"
      );
    });
  });

  describe("disconnection handling", () => {
    it("removes client from manager on close", async () => {
      const ws = createMockWebSocket() as WebSocket & { emit: Function };
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));
      expect(clientManager.getRoomForClient(ws)).toBe("user123/url-shortener");

      ws.emit("close");

      expect(clientManager.getRoomForClient(ws)).toBeUndefined();
    });

    it("removes client from manager on error", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      const ws = createMockWebSocket() as WebSocket & { emit: Function };
      const req = createMockRequest("/ws/owner/user123/url-shortener");

      wss.emit("connection", ws, req);
      await new Promise((r) => setTimeout(r, 10));

      ws.emit("error", new Error("Connection error"));

      expect(clientManager.getRoomForClient(ws)).toBeUndefined();
    });
  });
});

describe("stripDiagramChanges", () => {
  it("removes diagram changes JSON patch from content", () => {
    const content = `My design notes here

Diagram changes (JSON Patch): [{"op":"add","path":"/elem1"}]`;

    expect(stripDiagramChanges(content)).toBe("My design notes here");
  });

  it("returns original content if no diagram changes marker", () => {
    const content = "Just some user comments without any patch";

    expect(stripDiagramChanges(content)).toBe(content);
  });

  it("handles empty content", () => {
    expect(stripDiagramChanges("")).toBe("");
  });

  it("handles content that is only the marker", () => {
    const content = "\n\nDiagram changes (JSON Patch): []";

    expect(stripDiagramChanges(content)).toBe("");
  });
});
