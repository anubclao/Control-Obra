type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightStore = new Map<string, Promise<unknown>>();

const DEFAULT_MAX_CACHE_KEYS = 500;
const REDIS_URL = process.env.REDIS_URL;

let redisClientPromise: Promise<any | null> | null = null;
let redisUnavailable = false;

async function getRedisClient() {
  if (!REDIS_URL || redisUnavailable) {
    return null;
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const IORedis = require('ioredis');
        const client = new IORedis(REDIS_URL);
        client.on('error', (error: unknown) => {
          console.error('Redis cache error:', error);
        });

        await client.ping();
        return client;
      } catch (error) {
        redisUnavailable = true;
        console.warn('Redis not available, falling back to in-memory cache');
        console.error(error);
        return null;
      }
    })();
  }

  return redisClientPromise;
}

async function getDistributedValue<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('Error getting distributed value:', error);
    return null;
  }
}

async function setDistributedValue<T>(key: string, value: T, ttlMs: number) {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('Error setting distributed value:', error);
  }
}

async function clearDistributedPrefix(prefix?: string) {
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }

  try {
    if (!prefix) {
      await redis.flushdb();
      return;
    }

    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Error clearing distributed prefix:', error);
  }
}

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }
}

function enforceMaxSize(maxKeys: number) {
  if (cacheStore.size <= maxKeys) {
    return;
  }

  const overflow = cacheStore.size - maxKeys;
  let removed = 0;

  for (const key of cacheStore.keys()) {
    cacheStore.delete(key);
    removed++;
    if (removed >= overflow) {
      break;
    }
  }
}

export async function getOrSetRuntimeCache<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
  maxKeys = DEFAULT_MAX_CACHE_KEYS
): Promise<T> {
  const distributedCached = await getDistributedValue<T>(key);
  if (distributedCached !== null) {
    return distributedCached;
  }

  const now = Date.now();
  const cached = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (inFlightStore.has(key)) {
    return inFlightStore.get(key) as Promise<T>;
  }

  const promise = producer()
    .then(async (value) => {
      cacheStore.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });

      await setDistributedValue(key, value, ttlMs);

      pruneExpiredEntries(Date.now());
      enforceMaxSize(maxKeys);

      return value;
    })
    .finally(() => {
      inFlightStore.delete(key);
    });

  inFlightStore.set(key, promise);
  return promise;
}

export async function clearRuntimeCache(prefix?: string) {
  await clearDistributedPrefix(prefix);

  if (!prefix) {
    cacheStore.clear();
    inFlightStore.clear();
    return;
  }

  for (const key of [...cacheStore.keys()]) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }

  for (const key of [...inFlightStore.keys()]) {
    if (key.startsWith(prefix)) {
      inFlightStore.delete(key);
    }
  }
}
