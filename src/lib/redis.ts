import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return globalForRedis.redis;
}

export const redis = getRedis();

export async function setVideoWatched(sessionId: string, ttl = 3600): Promise<void> {
  await redis.set(`video:${sessionId}`, '1', 'EX', ttl);
}

export async function isVideoWatched(sessionId: string): Promise<boolean> {
  const val = await redis.get(`video:${sessionId}`);
  return val === '1';
}
