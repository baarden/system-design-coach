export interface MetricsProvider {
  /**
   * Increment a counter metric by 1.
   */
  increment(name: string): void;

  /**
   * Record a value for a metric (e.g., gauge, histogram).
   */
  record(name: string, value: number): void;

  /**
   * Flush any buffered metrics to the backend.
   */
  flush(): Promise<void>;

  /**
   * Start periodic collection of system metrics.
   */
  startPeriodicCollection(intervalMs: number): void;

  /**
   * Stop periodic collection of system metrics.
   */
  stopPeriodicCollection(): void;
}
