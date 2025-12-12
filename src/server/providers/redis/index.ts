import Redis from 'ioredis';
import type { RedisConfig } from './types.js';
import { logger } from '../../utils/logger.js';

export function createRedisClient(config: RedisConfig): Redis {
  const client = new Redis(config.url, {
    keyPrefix: config.keyPrefix,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error('Redis max retries reached, giving up');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      logger.info('Redis retrying connection', { delayMs: delay });
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => {
    logger.info('Redis connected');
  });

  client.on('error', (err) => {
    logger.error('Redis error', { error: err.message });
  });

  client.on('close', () => {
    logger.info('Redis connection closed');
  });

  return client;
}

export type { RedisConfig } from './types.js';
