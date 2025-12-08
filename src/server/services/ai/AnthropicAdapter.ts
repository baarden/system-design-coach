import Anthropic from "@anthropic-ai/sdk";
import type {
  AIClient,
  AIContentBlock,
  AIMessageRequest,
  AIMessageResponse,
} from "./types.js";

/**
 * Adapter that wraps the Anthropic SDK to implement AIClient interface.
 * This allows for easier testing by enabling mock implementations.
 */
export class AnthropicAdapter implements AIClient {
  constructor(private anthropic: Anthropic) {}

  async createMessage(request: AIMessageRequest): Promise<AIMessageResponse> {
    const response = await this.anthropic.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages,
      tools: request.tools,
    });

    // Map SDK content blocks to our simplified types
    const content: AIContentBlock[] = response.content
      .filter((block): block is Anthropic.TextBlock | Anthropic.ToolUseBlock =>
        block.type === "text" || block.type === "tool_use"
      )
      .map((block) => {
        if (block.type === "text") {
          return { type: "text" as const, text: block.text };
        }
        return {
          type: "tool_use" as const,
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      });

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
