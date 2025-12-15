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

export const MetricNames = {
  QUERY_EXECUTED: 'QueryExecuted',
  ROOM_CREATED: 'RoomCreated',
} as const;

export type MetricName = (typeof MetricNames)[keyof typeof MetricNames];
