import { Redis as UpstashRedis } from "@upstash/redis";
import { Redis as NodeRedis } from "@upstash/redis/node";

let redis: UpstashRedis | null = null;

try {
  // Try the convenient fromEnv() helper (works in many runtimes)
  redis = UpstashRedis.fromEnv();
} catch (err) {
  // If Redis not configured via fromEnv, callers should handle gracefully
  console.warn("/lib/redis: Upstash Redis not configured or fromEnv failed", err);
}

export async function setOtp(key: string, code: string, ttlSeconds = 300) {
  if (!redis) return false;
  try {
    await redis.set(key, code, { ex: ttlSeconds });
    return true;
  } catch (err) {
    console.warn("/lib/redis setOtp failed", err);
    return false;
  }
}

export async function getAndDeleteOtp(key: string) {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    if (!val) return null;
    // best-effort delete
    try {
      await redis.del(key);
    } catch (e) {
      console.warn("/lib/redis: failed to del key after get", e);
    }
    return typeof val === "string" ? val : String(val);
  } catch (err) {
    console.warn("/lib/redis getAndDeleteOtp failed", err);
    return null;
  }
}

export { redis };

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redisClient =
  url && token
    ? new NodeRedis({
        url,
        token,
      })
    : null;

export const redisEnabled = Boolean(redisClient);
