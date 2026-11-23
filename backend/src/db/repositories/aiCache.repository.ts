import { getDb } from '../index.js';
import type { DbClient } from '../client.js';

export const aiCacheRepository = {
  async get(cacheKey: string, db: DbClient = getDb()): Promise<string | null> {
    const row = await db.queryOne<{ optimized_text: string }>(
      'SELECT optimized_text FROM ai_cache WHERE cache_key = ?',
      [cacheKey],
    );
    return row?.optimized_text ?? null;
  },

  async set(
    cacheKey: string,
    optimizedText: string,
    provider: string,
    db: DbClient = getDb(),
  ): Promise<void> {
    await db.execute(
      `INSERT INTO ai_cache (cache_key, optimized_text, provider, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (cache_key) DO UPDATE SET optimized_text = excluded.optimized_text`,
      [cacheKey, optimizedText, provider, new Date().toISOString()],
    );
  },
};
