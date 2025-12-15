import type { MetricsProvider } from './types.js';

export class NoopMetricsProvider implements MetricsProvider {
  increment(_name: string): void {
    // No-op
  }

  record(_name: string, _value: number): void {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
  }

  startPeriodicCollection(_intervalMs: number): void {
    // No-op
  }

  stopPeriodicCollection(): void {
    // No-op
  }
}
