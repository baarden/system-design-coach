import { NoopMetricsProvider } from './NoopMetricsProvider.js';
import type { MetricsProvider } from './types.js';

export { MetricNames, type MetricName } from './types.js';
export type { MetricsProvider } from './types.js';
export { NoopMetricsProvider } from './NoopMetricsProvider.js';

let metricsProvider: MetricsProvider = new NoopMetricsProvider();

export function setMetricsProvider(provider: MetricsProvider): void {
  metricsProvider = provider;
}

export function getMetricsProvider(): MetricsProvider {
  return metricsProvider;
}

export { metricsProvider };
