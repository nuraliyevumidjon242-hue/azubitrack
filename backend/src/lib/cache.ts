import { createClient } from 'redis';
import { getConfig } from './config.js';
import { logger } from './logger.js';

interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  connect(): Promise<unknown>;
  quit(): Promise<unknown>;
}

let client: CacheClient | null = null;
let unavailable = false;
let connecting: Promise<CacheClient | null> | null = null;

async function getRedis(): Promise<CacheClient | null> {
  const url = getConfig().redisUrl;
  if (!url || unavailable) return null;
  if (client) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const instance = createClient({
        url,
        socket: { connectTimeout: 1200, reconnectStrategy: false },
      }) as unknown as CacheClient;
      instance.on('error', (error) => {
        if (!unavailable) {
          logger.warn({ err: error }, 'Redis unavailable — falling back to database cache');
        }
        unavailable = true;
      });
      await instance.connect();
      client = instance;
      logger.info('Redis cache connected');
      return instance;
    } catch (error) {
      unavailable = true;
      logger.warn({ err: error }, 'Redis connection failed — using database cache');
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

export async function cacheGet(key: string): Promise<string | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds = 7 * 24 * 60 * 60): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { EX: ttlSeconds });
  } catch {
    // Cache writes are best effort.
  }
}

export async function closeCache(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore
    }
    client = null;
  }
}
