import type Anthropic from "@anthropic-ai/sdk";

/**
 * Message role for conversation messages
 */
export type MessageRole = "user" | "assistant";

/**
 * A message in the conversation
 */
export interface AIMessage {
  role: MessageRole;
  content: string;
}

/**
 * Tool definition for Claude API
 */
export type AITool = Anthropic.Tool;

/**
 * Content block in response (text or tool_use)
 */
export type AIContentBlock = AITextBlock | AIToolUseBlock;

/**
 * Text content block
 */
export interface AITextBlock {
  type: "text";
  text: string;
}

/**
 * Tool use content block
 */
export interface AIToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Token usage information
 */
export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Tool choice configuration
 */
export type AIToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "tool"; name: string };

/**
 * Request to create a message
 */
export interface AIMessageRequest {
  model: string;
  maxTokens: number;
  system: string;
  messages: AIMessage[];
  tools?: AITool[];
  toolChoice?: AIToolChoice;
}

/**
 * Response from creating a message
 */
export interface AIMessageResponse {
  content: AIContentBlock[];
  usage: AIUsage;
}

/**
 * Interface for AI client implementations
 */
export interface AIClient {
  createMessage(request: AIMessageRequest): Promise<AIMessageResponse>;
}
