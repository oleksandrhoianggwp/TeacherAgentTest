import Redis from "ioredis";
import type { Env } from "./env.js";

export type RedisClient = Redis;

export function createRedis(env: Env): RedisClient | null {
  if (!env.REDIS_URL) return null;
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
}

export async function rateLimitOrThrow(opts: {
  redis: RedisClient | null;
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  if (!opts.redis) return;
  const { redis, key, limit, windowSeconds } = opts;
  const redisKey = `rl:${key}`;

  const tx = redis.multi();
  tx.incr(redisKey);
  tx.expire(redisKey, windowSeconds, "NX");
  const res = await tx.exec();

  const count = Number(res?.[0]?.[1] ?? 0);
  if (count > limit) {
    throw new Error("rate_limited");
  }
}

