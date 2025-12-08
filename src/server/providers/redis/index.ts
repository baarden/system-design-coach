import Redis from 'ioredis';
import type { RedisConfig } from './types.js';

export function createRedisClient(config: RedisConfig): Redis {
  const client = new Redis(config.url, {
    keyPrefix: config.keyPrefix,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('[Redis] Max retries reached, giving up');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      console.log(`[Redis] Retrying connection in ${delay}ms...`);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  client.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed');
  });

  return client;
}

export type { RedisConfig } from './types.js';
