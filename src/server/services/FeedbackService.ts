import type WebSocket from "ws";
import type { ServerElement } from "../../shared/types/excalidraw.js";
import type { AsyncStateManager } from "../managers/types.js";
import type { YjsDocManager } from "../managers/YjsDocManager.js";
import { UsageProvider } from "../providers/usage/types.js";
import { metricsProvider, MetricNames } from "../providers/metrics/index.js";
import type { ProblemRepository } from "../repositories/ProblemRepository.js";
import type { AIClient, AITool, AIToolUseBlock } from "./ai/types.js";
import type { MessageBroadcaster } from "./MessageBroadcaster.js";
import { filterElementsForClaude } from "../utils/elementFilters.js";
import { logger } from "../utils/logger.js";
import {
  elementsArrayToObject,
  generateElementsPatch,
} from "../utils/jsonPatch.js";
import {
  GetFeedbackMessage,
  StatusMessage,
  DiagramChange,
  ClaudeFeedbackMessage,
  NextPromptMessage,
  ElementsBatchCreatedMessage,
} from "../types/websocket.js";
import { parseProblemIdFromRoomId } from "../utils/roomUtils.js";

const SYSTEM_PROMPT_TEMPLATE = (problemStatement: string) =>
  `You are an experienced system design reviewer. Provide constructive feedback on the user's system design diagram and comments in the context of your last prompt. Comment on parts of the answer that don't clearly address the prompt, or don't have an appropriate level of detail. Make a clear distinction between critical and supplemental components. Try to limit feedback to 200-300 words. Also provide a prompt to the user to elaborate on the part of the diagram you think is most important to follow up on, unless you think the design is complete and clear. Here was the user prompt: ${problemStatement}`;

interface FeedbackServiceDependencies {
  aiClient: AIClient;
  stateManager: AsyncStateManager;
  /** Optional YjsDocManager for reading authoritative real-time element state */
  yjsDocManager?: YjsDocManager;
  broadcaster: MessageBroadcaster;
  usageProvider: UsageProvider;
  problemRepository: ProblemRepository;
  claudeModel?: string;
}

export class FeedbackService {
  private aiClient: AIClient;
  private stateManager: AsyncStateManager;
  private yjsDocManager?: YjsDocManager;
  private broadcaster: MessageBroadcaster;
  private usageProvider: UsageProvider;
  private problemRepository: ProblemRepository;
  private claudeModel: string;

  constructor(deps: FeedbackServiceDependencies) {
    this.aiClient = deps.aiClient;
    this.stateManager = deps.stateManager;
    this.yjsDocManager = deps.yjsDocManager;
    this.broadcaster = deps.broadcaster;
    this.usageProvider = deps.usageProvider;
    this.problemRepository = deps.problemRepository;
    this.claudeModel = deps.claudeModel || "claude-sonnet-4-5";
  }

  async handleGetFeedback(
    ws: WebSocket,
    roomId: string,
    data: GetFeedbackMessage,
    userId: string
  ): Promise<void> {
    try {
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

      // Initialize conversation if not exists
      let conversation = await this.stateManager.getConversation(roomId);
      if (!conversation) {
        conversation = await this.stateManager.initializeConversation(
          roomId,
          problemId,
          problem.statement
        );
      }

      // Retrieve and filter Excalidraw elements for the room
      // Prefer YjsDocManager for authoritative real-time state (avoids race conditions)
      // Fall back to stateManager for backwards compatibility
      let elements: ServerElement[];
      if (this.yjsDocManager) {
        elements = this.yjsDocManager.getElements(roomId);
      } else {
        elements = Array.from(
          (await this.stateManager.getElements(roomId)).values()
        );
      }
      const filteredElements = filterElementsForClaude(elements);

      // Generate JSON Patch diff
      const currentElementsObj = elementsArrayToObject(filteredElements);
      const previousElementsObj = await this.stateManager.getPreviousElements(roomId);
      const patch = generateElementsPatch(previousElementsObj, currentElementsObj);

      // Build user message content with diff
      let userContent = data.userComments;
      if (patch.length > 0) {
        userContent += `\n\nDiagram changes (JSON Patch): ${JSON.stringify(patch)}`;
      }

      // Build messages array from conversation history
      // Only include feedback messages, not chat messages
      // Filter out any messages with empty content to avoid Claude API errors
      const messagesForClaude: Array<{ role: "user" | "assistant"; content: string }> =
        conversation.messages
          .filter((msg) => msg.content?.trim() && msg.source === "feedback")
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

      // Add current user message
      messagesForClaude.push({
        role: "user",
        content: userContent,
      });

      // Define the feedback tool
      const feedbackTool: AITool = {
        name: "give_system_design_feedback",
        description:
          'Send feedback to the user on their system design diagram and comments. To help the user see which ambiguous diagram components you are referencing (and only ambiguous components), use diagram_changes to add numbered labels to those elements, then reference those numbers in your feedback text (e.g., "The first database [1] should...").',
        input_schema: {
          type: "object" as const,
          properties: {
            feedback: {
              type: "string",
              description:
                "Feedback text shown to the user. Reference ambiguous diagram elements (and only ambiguous elements) using brackets like [1], [2], etc. to correspond with the numbers assigned in diagram_changes.",
            },
            diagram_changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  objectId: {
                    type: "string",
                    description:
                      "The unique ID of the diagram object to label.",
                  },
                  number: {
                    type: "integer",
                    description:
                      "The label number to display on this object. Use sequential numbers starting from 1.",
                  },
                },
                required: ["objectId", "number"],
              },
              description:
                "Labels to add to ambiguous diagram objects. ONLY label components when multiple objects share the same name or are otherwise indistinguishable. If a component has a unique name in the diagram, reference it directly by name in your feedback text without adding a label.",
            },
            next_prompt: {
              type: "string",
              description:
                "A follow-up prompt to ask the user, if any. This could be to clarify something in their design, or to request more information. If no follow-up is needed, leave this field empty.",
            },
          },
          required: ["feedback"],
        },
      };

      // Call Claude API with tool use
      const response = await this.aiClient.createMessage({
        model: this.claudeModel,
        maxTokens: 1000,
        system: SYSTEM_PROMPT_TEMPLATE(problem.statement),
        tools: [feedbackTool],
        toolChoice: { type: "tool", name: "give_system_design_feedback" },
        messages: messagesForClaude,
      });

      await this.usageProvider.recordUsage(userId, {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      }, (msg) => ws.send(JSON.stringify(msg)));

      metricsProvider.increment(MetricNames.QUERY_EXECUTED);

      // Extract tool use from response
      const toolUseBlock = response.content.find(
        (block): block is AIToolUseBlock => block.type === "tool_use"
      );

      if (
        !toolUseBlock ||
        toolUseBlock.name !== "give_system_design_feedback"
      ) {
        logger.error("Claude did not use expected tool", {
          roomId,
          contentTypes: response.content.map((b) => b.type),
          textContent: response.content
            .filter((b): b is { type: "text"; text: string } => b.type === "text")
            .map((b) => b.text.substring(0, 500)),
        });
        throw new Error("Expected tool use response from Claude");
      }

      const toolInput = toolUseBlock.input as {
        feedback: string;
        diagram_changes?: DiagramChange[];
        next_prompt?: string;
      };
      const { feedback, diagram_changes = [], next_prompt } = toolInput;

      // Store user message in conversation
      await this.stateManager.addMessage(roomId, {
        role: "user",
        content: userContent,
        timestamp: new Date().toISOString(),
        source: "feedback",
      });

      // Store assistant message (feedback only) in conversation
      await this.stateManager.addMessage(roomId, {
        role: "assistant",
        content: feedback,
        timestamp: new Date().toISOString(),
        source: "feedback",
      });

      // Update previous elements for next diff
      await this.stateManager.setPreviousElements(roomId, currentElementsObj);

      // Sync Y.Doc elements to Redis for persistence (enables recovery on restart)
      // First, remove elements that no longer exist in Y.Doc
      const currentIds = new Set(elements.map((el) => el.id));
      const storedElements = await this.stateManager.getElements(roomId);
      const deletePromises = Array.from(storedElements.keys())
        .filter((id) => !currentIds.has(id))
        .map((id) => this.stateManager.deleteElement(id, roomId));
      // Then save all current elements
      const savePromises = elements.map((el) =>
        this.stateManager.setElement(el.id, el, roomId)
      );
      await Promise.all([...deletePromises, ...savePromises]);

      // Create numbered labels for diagram changes
      const newElements = await this.createLabelElements(roomId, diagram_changes);

      // Broadcast new elements to all clients in the room
      if (newElements.length > 0) {
        const elementsMessage: ElementsBatchCreatedMessage = {
          type: "elements_batch_created",
          elements: newElements,
          timestamp: new Date().toISOString(),
        };
        this.broadcaster.broadcast(elementsMessage, roomId);
      }

      // Send claude-feedback event with response text
      const feedbackMessage: ClaudeFeedbackMessage = {
        type: "claude-feedback",
        responseText: feedback,
        timestamp: new Date().toISOString(),
      };
      this.broadcaster.broadcast(feedbackMessage, roomId);

      // Broadcast and persist next_prompt if present
      if (next_prompt) {
        await this.stateManager.setCurrentProblemStatement(roomId, next_prompt);
        const nextPromptMessage: NextPromptMessage = {
          type: "next-prompt",
          nextPrompt: next_prompt,
          timestamp: new Date().toISOString(),
        };
        this.broadcaster.broadcast(nextPromptMessage, roomId);
      }

      // Send completed status back to client
      const statusMessage: StatusMessage = {
        type: "status",
        eventId: data.eventId,
        status: "completed",
      };
      ws.send(JSON.stringify(statusMessage));
    } catch (error) {
      logger.error("Error handling get-feedback", { error: (error as Error).message });

      // Send error status back to client
      const errorMessage: StatusMessage = {
        type: "status",
        eventId: data.eventId,
        status: "error",
        message: (error as Error).message,
      };
      ws.send(JSON.stringify(errorMessage));
    }
  }

  /**
   * Creates label elements for diagram changes.
   * Returns skeleton elements (ellipse with label property) that the client
   * will convert using convertToExcalidrawElements to create properly bound text.
   */
  private async createLabelElements(
    roomId: string,
    diagramChanges: DiagramChange[]
  ): Promise<Record<string, unknown>[]> {
    const skeletonElements: Record<string, unknown>[] = [];
    const elementMap = await this.stateManager.getElements(roomId);

    for (const change of diagramChanges) {
      const referencedElement = elementMap.get(change.objectId);
      if (!referencedElement) {
        logger.warn("Referenced element not found, skipping label", { objectId: change.objectId });
        continue;
      }

      // Create unique ID for the circle
      const circleId = `claude-circle-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;

      // Position in upper-left corner (offset by -5px from x and y)
      const circleX = referencedElement.x - 5;
      const circleY = referencedElement.y - 5;

      // Create skeleton element with label property
      // convertToExcalidrawElements will create the bound text element
      const skeletonElement = {
        id: circleId,
        type: "ellipse",
        x: circleX,
        y: circleY,
        width: 40,
        height: 40,
        strokeColor: "#1971c2",
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 0,
        // Label property - convertToExcalidrawElements creates bound text from this
        label: {
          text: change.number.toString(),
          fontSize: 20,
          strokeColor: "#1e1e1e",
        },
      };

      skeletonElements.push(skeletonElement);
    }

    return skeletonElements;
  }
}
