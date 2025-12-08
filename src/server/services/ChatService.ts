import type WebSocket from "ws";
import type { AsyncStateManager } from "../managers/types.js";
import { UsageProvider } from "../providers/usage/types.js";
import type { ProblemRepository } from "../repositories/ProblemRepository.js";
import type { AIClient } from "./ai/types.js";
import {
  ChatMessage,
  ChatResponseMessage,
  StatusMessage,
} from "../types/websocket.js";
import { parseProblemIdFromRoomId } from "../utils/roomUtils.js";

const CHAT_SYSTEM_PROMPT =
  "You are an experienced system design reviewer. The user is working on a software system design problem. You are coaching the user in a chat window, and you should not offer to solve the problem for the user, or to change the design problem.";

interface ChatServiceDependencies {
  aiClient: AIClient;
  stateManager: AsyncStateManager;
  usageProvider: UsageProvider;
  problemRepository: ProblemRepository;
  claudeModel?: string;
}

export class ChatService {
  private aiClient: AIClient;
  private stateManager: AsyncStateManager;
  private usageProvider: UsageProvider;
  private problemRepository: ProblemRepository;
  private claudeModel: string;

  constructor(deps: ChatServiceDependencies) {
    this.aiClient = deps.aiClient;
    this.stateManager = deps.stateManager;
    this.usageProvider = deps.usageProvider;
    this.problemRepository = deps.problemRepository;
    this.claudeModel = deps.claudeModel || "claude-sonnet-4-5";
  }

  async handleChatMessage(
    ws: WebSocket,
    roomId: string,
    data: ChatMessage,
    userId: string
  ): Promise<void> {
    try {
      // Validate message is not empty
      if (!data.message?.trim()) {
        const errorMessage: StatusMessage = {
          type: "status",
          eventId: data.eventId,
          status: "error",
          message: "Message cannot be empty",
        };
        ws.send(JSON.stringify(errorMessage));
        return;
      }

      // Check if user can perform this action
      const unavailableReason = await this.usageProvider.checkAvailability(
        userId
      );
      if (unavailableReason) {
        const unavailableMessage: StatusMessage = {
          type: "status",
          eventId: data.eventId,
          status: "error",
          message: unavailableReason,
          needsCredits: true,
        };
        ws.send(JSON.stringify(unavailableMessage));
        return;
      }

      // Get problem from room ID
      const problemId = parseProblemIdFromRoomId(roomId);
      if (!problemId) {
        throw new Error("Could not parse problemId from roomId");
      }

      const problem = this.problemRepository.getProblem(problemId);
      if (!problem) {
        throw new Error(`Problem '${problemId}' not found`);
      }

      // Get or initialize conversation
      let conversation = await this.stateManager.getConversation(roomId);
      if (!conversation) {
        conversation = await this.stateManager.initializeConversation(
          roomId,
          problemId,
          problem.statement
        );
      }

      // Build messages array from conversation history (all messages - chat + feedback)
      // Filter out any messages with empty content to avoid Claude API errors
      const messagesForClaude: Array<{
        role: "user" | "assistant";
        content: string;
      }> = conversation.messages
        .filter((msg) => msg.content?.trim())
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      // Add current user message
      messagesForClaude.push({
        role: "user",
        content: data.message,
      });

      // Call Claude API
      const response = await this.aiClient.createMessage({
        model: this.claudeModel,
        maxTokens: 1000,
        system: CHAT_SYSTEM_PROMPT,
        messages: messagesForClaude,
      });

      await this.usageProvider.recordUsage(userId, {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      });

      // Extract text response
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Expected text response from Claude");
      }

      const responseText = textBlock.text;

      // Store user message in conversation
      await this.stateManager.addMessage(roomId, {
        role: "user",
        content: data.message,
        timestamp: new Date().toISOString(),
        source: "chat",
      });

      // Store assistant message in conversation
      await this.stateManager.addMessage(roomId, {
        role: "assistant",
        content: responseText,
        timestamp: new Date().toISOString(),
        source: "chat",
      });

      // Send chat response to client
      const chatResponse: ChatResponseMessage = {
        type: "chat-response",
        message: responseText,
        timestamp: new Date().toISOString(),
      };
      ws.send(JSON.stringify(chatResponse));

      // Send completed status
      const statusMessage: StatusMessage = {
        type: "status",
        eventId: data.eventId,
        status: "completed",
      };
      ws.send(JSON.stringify(statusMessage));
    } catch (error) {
      console.error("Error handling chat message:", error);

      const errorMessage: StatusMessage = {
        type: "status",
        eventId: data.eventId,
        status: "error",
        message: (error as Error).message,
      };
      ws.send(JSON.stringify(errorMessage));
    }
  }
}
