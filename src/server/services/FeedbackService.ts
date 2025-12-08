import type WebSocket from "ws";
import type { ServerElement } from "../../shared/types/excalidraw.js";
import type { AsyncStateManager } from "../managers/types.js";
import { UsageProvider } from "../providers/usage/types.js";
import type { ProblemRepository } from "../repositories/ProblemRepository.js";
import type { AIClient, AITool, AIToolUseBlock } from "./ai/types.js";
import type { MessageBroadcaster } from "./MessageBroadcaster.js";
import { filterElementsForClaude } from "../utils/elementFilters.js";
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
  broadcaster: MessageBroadcaster;
  usageProvider: UsageProvider;
  problemRepository: ProblemRepository;
  claudeModel?: string;
}

export class FeedbackService {
  private aiClient: AIClient;
  private stateManager: AsyncStateManager;
  private broadcaster: MessageBroadcaster;
  private usageProvider: UsageProvider;
  private problemRepository: ProblemRepository;
  private claudeModel: string;

  constructor(deps: FeedbackServiceDependencies) {
    this.aiClient = deps.aiClient;
    this.stateManager = deps.stateManager;
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
      const elements = Array.from(
        (await this.stateManager.getElements(roomId)).values()
      );
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
        messages: messagesForClaude,
      });

      await this.usageProvider.recordUsage(userId, {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      });

      // Extract tool use from response
      const toolUseBlock = response.content.find(
        (block): block is AIToolUseBlock => block.type === "tool_use"
      );

      if (
        !toolUseBlock ||
        toolUseBlock.name !== "give_system_design_feedback"
      ) {
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

      // Broadcast next_prompt if present
      if (next_prompt) {
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
      console.error("Error handling get-feedback:", error);

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

  private async createLabelElements(
    roomId: string,
    diagramChanges: DiagramChange[]
  ): Promise<ServerElement[]> {
    const newElements: ServerElement[] = [];
    const elementMap = await this.stateManager.getElements(roomId);

    for (const change of diagramChanges) {
      const referencedElement = elementMap.get(change.objectId);
      if (!referencedElement) {
        console.warn(
          `Referenced element ${change.objectId} not found, skipping label`
        );
        continue;
      }

      // Create unique IDs for circle and text
      const circleId = `claude-circle-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      const textId = `claude-text-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;

      // Position in upper-left corner (offset by -5px from x and y)
      const circleX = referencedElement.x - 5;
      const circleY = referencedElement.y - 5;

      // Create circle element (40x40, blue background)
      const circleElement: ServerElement = {
        id: circleId,
        type: "ellipse",
        x: circleX,
        y: circleY,
        width: 40,
        height: 40,
        angle: 0,
        strokeColor: "#1971c2",
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 1000000),
        versionNonce: Math.floor(Math.random() * 1000000),
        isDeleted: false,
        boundElements: [{ type: "text", id: textId }],
        locked: false,
        link: null,
        syncedAt: new Date().toISOString(),
        version: 1,
      };

      // Create text element (centered in circle)
      const textElement: ServerElement = {
        id: textId,
        type: "text",
        x: circleX + 20,
        y: circleY + 20,
        width: 0,
        height: 0,
        angle: 0,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: Math.floor(Math.random() * 1000000),
        versionNonce: Math.floor(Math.random() * 1000000),
        isDeleted: false,
        locked: false,
        link: null,
        containerId: circleId,
        syncedAt: new Date().toISOString(),
        version: 1,
        // Text-specific properties
        ...{
          text: change.number.toString(),
          fontSize: 20,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          baseline: 18,
          originalText: change.number.toString(),
        },
      };

      // Add elements to state
      await this.stateManager.setElement(circleId, circleElement, roomId);
      await this.stateManager.setElement(textId, textElement, roomId);

      newElements.push(circleElement, textElement);
    }

    return newElements;
  }
}
