export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface UsageProvider {
  /**
   * Check if user can perform an action.
   * @returns null if available, or error message if not
   */
  checkAvailability(userId: string): Promise<string | null>;

  /**
   * Record usage after an action completes.
   * Provider handles any billing/tracking internally.
   * @param notify Optional callback to send messages to the client
   */
  recordUsage(
    userId: string,
    usage: TokenUsage,
    notify?: (message: unknown) => void
  ): Promise<void>;
}
