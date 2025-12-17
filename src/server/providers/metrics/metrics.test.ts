import { describe, it, expect, beforeEach } from 'vitest';
import { NoopMetricsProvider } from './NoopMetricsProvider.js';
import {
  getMetricsProvider,
  setMetricsProvider,
  metricsProvider,
  MetricNames,
} from './index.js';
import type { MetricsProvider } from './types.js';

describe('NoopMetricsProvider', () => {
  let provider: NoopMetricsProvider;

  beforeEach(() => {
    provider = new NoopMetricsProvider();
  });

  it('increment does not throw', () => {
    expect(() => provider.increment('test_metric')).not.toThrow();
  });

  it('record does not throw', () => {
    expect(() => provider.record('test_metric', 42)).not.toThrow();
  });

  it('flush returns a resolved promise', async () => {
    await expect(provider.flush()).resolves.toBeUndefined();
  });

  it('startPeriodicCollection does not throw', () => {
    expect(() => provider.startPeriodicCollection(1000)).not.toThrow();
  });

  it('stopPeriodicCollection does not throw', () => {
    expect(() => provider.stopPeriodicCollection()).not.toThrow();
  });
});

describe('metrics provider getter/setter', () => {
  beforeEach(() => {
    // Reset to default provider before each test
    setMetricsProvider(new NoopMetricsProvider());
  });

  it('getMetricsProvider returns the current provider', () => {
    const provider = getMetricsProvider();
    expect(provider).toBeDefined();
    expect(provider).toBeInstanceOf(NoopMetricsProvider);
  });

  it('setMetricsProvider replaces the provider', () => {
    const customProvider: MetricsProvider = {
      increment: () => {},
      record: () => {},
      flush: async () => {},
      startPeriodicCollection: () => {},
      stopPeriodicCollection: () => {},
    };

    setMetricsProvider(customProvider);

    expect(getMetricsProvider()).toBe(customProvider);
  });

  it('metricsProvider export reflects the current provider', () => {
    expect(metricsProvider).toBeDefined();
    expect(metricsProvider).toBeInstanceOf(NoopMetricsProvider);
  });
});

describe('MetricNames', () => {
  it('exports expected metric name constants', () => {
    expect(MetricNames.QUERY_EXECUTED).toBe('QueryExecuted');
    expect(MetricNames.ROOM_CREATED).toBe('RoomCreated');
  });
});
