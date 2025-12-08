import type { UsageProvider, TokenUsage } from './types.js';

export class NoopUsageProvider implements UsageProvider {
  async checkAvailability(_userId: string): Promise<string | null> {
    return null; // Always available
  }

  async recordUsage(_userId: string, _usage: TokenUsage): Promise<void> {
    // No-op
  }
}
