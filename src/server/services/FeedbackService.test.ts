import { describe, it, expect, vi, beforeEach } from "vitest";
import { FeedbackService } from "./FeedbackService.js";
import { MultiRoomStateManager } from "../managers/MultiRoomStateManager.js";
import { createTestProblemRepository } from "../repositories/ProblemRepository.js";
import type { AIClient, AIMessageResponse } from "./ai/types.js";
import type { MessageBroadcaster } from "./MessageBroadcaster.js";
import type { UsageProvider } from "../providers/usage/types.js";
import type { WebSocket } from "ws";
import type { GetFeedbackMessage } from "../types/websocket.js";

// Mock WebSocket
function createMockWebSocket(): WebSocket {
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as WebSocket;
}

// Mock AI Client
function createMockAIClient(response?: Partial<AIMessageResponse>): AIClient {
  const defaultResponse: AIMessageResponse = {
    content: [
      {
        type: "tool_use",
        id: "tool_1",
        name: "give_system_design_feedback",
        input: {
          feedback: "Great design! Consider adding caching.",
          diagram_changes: [],
          next_prompt: "How will you handle cache invalidation?",
        },
      },
    ],
    usage: { inputTokens: 100, outputTokens: 50 },
  };

  return {
    createMessage: vi.fn().mockResolvedValue({ ...defaultResponse, ...response }),
  };
}

// Mock Broadcaster
function createMockBroadcaster(): MessageBroadcaster {
  return {
    broadcast: vi.fn(),
  };
}

// Mock Usage Provider
function createMockUsageProvider(
  available = true
): UsageProvider {
  return {
    checkAvailability: vi.fn().mockResolvedValue(available ? null : "No credits"),
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

describe("FeedbackService", () => {
  let service: FeedbackService;
  let stateManager: MultiRoomStateManager;
  let aiClient: AIClient;
  let broadcaster: MessageBroadcaster;
  let usageProvider: UsageProvider;
  let ws: WebSocket;

  beforeEach(() => {
    stateManager = new MultiRoomStateManager();
    aiClient = createMockAIClient();
    broadcaster = createMockBroadcaster();
    usageProvider = createMockUsageProvider();
    ws = createMockWebSocket();

    service = new FeedbackService({
      aiClient,
      stateManager,
      broadcaster,
      usageProvider,
      problemRepository: createTestProblemRepository(testProblems),
    });
  });

  describe("handleGetFeedback", () => {
    const roomId = "user123/url-shortener";
    const feedbackMessage: GetFeedbackMessage = {
      type: "get-feedback",
      eventId: "event1",
      userComments: "I added a database for storing URLs",
      userId: "user123",
    };

    it("sends feedback response to clients via broadcaster", async () => {
      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      expect(broadcaster.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "claude-feedback",
          responseText: "Great design! Consider adding caching.",
        }),
        roomId
      );
    });

    it("sends next prompt when provided", async () => {
      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      expect(broadcaster.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "next-prompt",
          nextPrompt: "How will you handle cache invalidation?",
        }),
        roomId
      );
    });

    it("sends completed status to requesting client", async () => {
      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "status",
          eventId: "event1",
          status: "completed",
        })
      );
    });

    it("records token usage", async () => {
      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      expect(usageProvider.recordUsage).toHaveBeenCalledWith("user123", {
        inputTokens: 100,
        outputTokens: 50,
      });
    });

    it("initializes conversation if not exists", async () => {
      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      const conversation = await stateManager.getConversation(roomId);
      expect(conversation).toBeDefined();
      expect(conversation?.problemId).toBe("url-shortener");
    });

    it("stores user and assistant messages in conversation", async () => {
      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      const conversation = await stateManager.getConversation(roomId);
      // Initial message + user message + assistant response
      expect(conversation?.messages.length).toBeGreaterThanOrEqual(3);

      const userMsg = conversation?.messages.find(
        (m) => m.role === "user" && m.source === "feedback"
      );
      expect(userMsg?.content).toContain("I added a database");
    });

    it("sends error status when user has no credits", async () => {
      usageProvider = createMockUsageProvider(false);
      service = new FeedbackService({
        aiClient,
        stateManager,
        broadcaster,
        usageProvider,
        problemRepository: createTestProblemRepository(testProblems),
      });

      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "status",
          eventId: "event1",
          status: "error",
          message: "No credits",
        })
      );
      expect(aiClient.createMessage).not.toHaveBeenCalled();
    });

    it("sends error status for unknown problem", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      await service.handleGetFeedback(ws, "user123/unknown-problem", feedbackMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
    });

    it("sends error status when AI client fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      aiClient = {
        createMessage: vi.fn().mockRejectedValue(new Error("API error")),
      };
      service = new FeedbackService({
        aiClient,
        stateManager,
        broadcaster,
        usageProvider,
        problemRepository: createTestProblemRepository(testProblems),
      });

      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "status",
          eventId: "event1",
          status: "error",
          message: "API error",
        })
      );
    });

    it("sends error when Claude returns non-tool response", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      aiClient = createMockAIClient({
        content: [{ type: "text", text: "Some text response" }],
      });
      service = new FeedbackService({
        aiClient,
        stateManager,
        broadcaster,
        usageProvider,
        problemRepository: createTestProblemRepository(testProblems),
      });

      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining("Expected tool use response")
      );
    });

    it("creates label elements for diagram changes", async () => {
      // Add an element to the room first
      await stateManager.setElement(
        "rect1",
        {
          id: "rect1",
          type: "rectangle",
          x: 100,
          y: 100,
          width: 50,
          height: 50,
        } as any,
        roomId
      );

      aiClient = createMockAIClient({
        content: [
          {
            type: "tool_use",
            id: "tool_1",
            name: "give_system_design_feedback",
            input: {
              feedback: "Check component [1]",
              diagram_changes: [{ objectId: "rect1", number: 1 }],
            },
          },
        ],
      });
      service = new FeedbackService({
        aiClient,
        stateManager,
        broadcaster,
        usageProvider,
        problemRepository: createTestProblemRepository(testProblems),
      });

      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      expect(broadcaster.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "elements_batch_created",
        }),
        roomId
      );
    });

    it("includes JSON patch diff in user message when elements changed", async () => {
      // Initialize conversation with previous elements
      await stateManager.initializeConversation(
        roomId,
        "url-shortener",
        "Test statement"
      );
      await stateManager.setPreviousElements(roomId, {
        elem1: { id: "elem1", type: "rectangle" },
      });

      // Add new element to room
      await stateManager.setElement(
        "elem2",
        { id: "elem2", type: "ellipse" } as any,
        roomId
      );

      await service.handleGetFeedback(ws, roomId, feedbackMessage, "user123");

      // Check that AI client was called with message containing patch
      expect(aiClient.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("JSON Patch"),
            }),
          ]),
        })
      );
    });
  });
});
