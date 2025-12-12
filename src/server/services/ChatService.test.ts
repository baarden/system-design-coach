import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "./ChatService.js";
import { MultiRoomStateManager } from "../managers/MultiRoomStateManager.js";
import { createTestProblemRepository } from "../repositories/ProblemRepository.js";
import type { AIClient, AIMessageResponse } from "./ai/types.js";
import type { UsageProvider } from "../providers/usage/types.js";
import type { WebSocket } from "ws";
import type { ChatMessage } from "../types/websocket.js";

// Mock WebSocket
function createMockWebSocket(): WebSocket {
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
}

// Mock AI Client
function createMockAIClient(responseText = "Great question!"): AIClient {
  const response: AIMessageResponse = {
    content: [{ type: "text", text: responseText }],
    usage: { inputTokens: 50, outputTokens: 25 },
  };

  return {
    createMessage: vi.fn().mockResolvedValue(response),
  };
}

// Mock Usage Provider
function createMockUsageProvider(available = true): UsageProvider {
  return {
    checkAvailability: vi.fn().mockResolvedValue(available ? null : "No credits available"),
    recordUsage: vi.fn().mockResolvedValue(undefined),
  };
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

describe("ChatService", () => {
  let service: ChatService;
  let stateManager: MultiRoomStateManager;
  let aiClient: AIClient;
  let usageProvider: UsageProvider;
  let ws: WebSocket;

  beforeEach(() => {
    stateManager = new MultiRoomStateManager();
    aiClient = createMockAIClient();
    usageProvider = createMockUsageProvider();
    ws = createMockWebSocket();

    service = new ChatService({
      aiClient,
      stateManager,
      usageProvider,
      problemRepository: createTestProblemRepository(testProblems),
    });
  });

  describe("handleChatMessage", () => {
    const roomId = "user123/url-shortener";
    const chatMessage: ChatMessage = {
      type: "chat-message",
      eventId: "event1",
      message: "How should I handle URL collisions?",
      userId: "user123",
    };

    it("sends chat response to client", async () => {
      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"chat-response"')
      );
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Great question!"')
      );
    });

    it("sends completed status to client", async () => {
      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "status",
          eventId: "event1",
          status: "completed",
        })
      );
    });

    it("records token usage", async () => {
      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      expect(usageProvider.recordUsage).toHaveBeenCalledWith(
        "user123",
        { inputTokens: 50, outputTokens: 25 },
        expect.any(Function)
      );
    });

    it("initializes conversation if not exists", async () => {
      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      const conversation = await stateManager.getConversation(roomId);
      expect(conversation).toBeDefined();
      expect(conversation?.problemId).toBe("url-shortener");
    });

    it("stores user and assistant messages with chat source", async () => {
      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      const conversation = await stateManager.getConversation(roomId);
      const chatMessages = conversation?.messages.filter(
        (m) => m.source === "chat"
      );
      expect(chatMessages?.length).toBe(2);
      expect(chatMessages?.[0].role).toBe("user");
      expect(chatMessages?.[0].content).toBe("How should I handle URL collisions?");
      expect(chatMessages?.[1].role).toBe("assistant");
    });

    it("sends error status for empty message", async () => {
      const emptyMessage: ChatMessage = {
        ...chatMessage,
        message: "   ",
      };

      await service.handleChatMessage(ws, roomId, emptyMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "status",
          eventId: "event1",
          status: "error",
          message: "Message cannot be empty",
        })
      );
      expect(aiClient.createMessage).not.toHaveBeenCalled();
    });

    it("sends error status when user has no credits", async () => {
      usageProvider = createMockUsageProvider(false);
      service = new ChatService({
        aiClient,
        stateManager,
        usageProvider,
        problemRepository: createTestProblemRepository(testProblems),
      });

      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "status",
          eventId: "event1",
          status: "error",
          message: "No credits available",
          needsCredits: true,
        })
      );
      expect(aiClient.createMessage).not.toHaveBeenCalled();
    });

    it("sends error status for unknown problem", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      await service.handleChatMessage(ws, "user123/unknown-problem", chatMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
    });

    it("sends error status when AI client fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      aiClient = {
        createMessage: vi.fn().mockRejectedValue(new Error("API error")),
      };
      service = new ChatService({
        aiClient,
        stateManager,
        usageProvider,
        problemRepository: createTestProblemRepository(testProblems),
      });

      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "status",
          eventId: "event1",
          status: "error",
          message: "API error",
        })
      );
    });

    it("includes conversation history in AI request", async () => {
      // Initialize with existing messages
      await stateManager.initializeConversation(
        roomId,
        "url-shortener",
        "Design a URL shortener"
      );
      await stateManager.addMessage(roomId, {
        role: "user",
        content: "Previous question",
        timestamp: new Date().toISOString(),
        source: "chat",
      });
      await stateManager.addMessage(roomId, {
        role: "assistant",
        content: "Previous answer",
        timestamp: new Date().toISOString(),
        source: "chat",
      });

      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      expect(aiClient.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: "assistant", content: "Design a URL shortener" },
            { role: "user", content: "Previous question" },
            { role: "assistant", content: "Previous answer" },
            { role: "user", content: "How should I handle URL collisions?" },
          ]),
        })
      );
    });

    it("filters out empty messages from conversation history", async () => {
      await stateManager.initializeConversation(
        roomId,
        "url-shortener",
        "Design a URL shortener"
      );
      await stateManager.addMessage(roomId, {
        role: "user",
        content: "",
        timestamp: new Date().toISOString(),
        source: "feedback",
      });

      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      // Verify empty message was filtered
      const call = (aiClient.createMessage as any).mock.calls[0][0];
      const emptyMessages = call.messages.filter(
        (m: any) => !m.content?.trim()
      );
      expect(emptyMessages).toHaveLength(0);
    });

    it("sends error when Claude returns no text", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      aiClient = {
        createMessage: vi.fn().mockResolvedValue({
          content: [],
          usage: { inputTokens: 10, outputTokens: 0 },
        }),
      };
      service = new ChatService({
        aiClient,
        stateManager,
        usageProvider,
        problemRepository: createTestProblemRepository(testProblems),
      });

      await service.handleChatMessage(ws, roomId, chatMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining("Expected text response")
      );
    });
  });
});
