export default async function healthRoutes(fastify) {
  fastify.get('/health', async () => {
    const [postgres, redis] = await Promise.allSettled([fastify.pgHealth(), fastify.redisHealth()]);

    const pgOk = postgres.status === 'fulfilled' && postgres.value === true;
    const redisOk = redis.status === 'fulfilled' && redis.value === true;
    const healthy = pgOk && redisOk;

    return {
      status: healthy ? 'ok' : 'degraded',
      service: 'prajashakti-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      checks: {
        postgres: pgOk ? 'connected' : 'error',
        redis: redisOk ? 'connected' : 'error',
      },
    };
  });
}
