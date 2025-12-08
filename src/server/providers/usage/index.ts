import { NoopUsageProvider } from "./NoopUsageProvider.js";
import type { UsageProvider } from "./types.js";

export type { UsageProvider, TokenUsage } from "./types.js";

const usageProvider: UsageProvider = new NoopUsageProvider();

export { usageProvider };
