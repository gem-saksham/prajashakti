/**
 * GET /api/v1/status
 * Rich health check: service latencies, memory, environment.
 * Replaces the bare /api/health used by Docker (which stays for backward compat).
 */

export default async function statusRoutes(fastify) {
  fastify.get('/status', async () => {
    const pgStart = Date.now();
    const redisStart = Date.now();

    const [pgResult, redisResult] = await Promise.allSettled([
      fastify.pgHealth().then(() => Date.now() - pgStart),
      fastify.redisHealth().then(() => Date.now() - redisStart),
    ]);

    const mem = process.memoryUsage();

    return {
      status:
        pgResult.status === 'fulfilled' && redisResult.status === 'fulfilled' ? 'ok' : 'degraded',
      version: '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      uptime: Math.round(process.uptime()),
      services: {
        postgres: {
          status: pgResult.status === 'fulfilled' ? 'connected' : 'error',
          latency_ms: pgResult.status === 'fulfilled' ? pgResult.value : null,
        },
        redis: {
          status: redisResult.status === 'fulfilled' ? 'connected' : 'error',
          latency_ms: redisResult.status === 'fulfilled' ? redisResult.value : null,
        },
      },
      memory: {
        used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        rss_mb: Math.round(mem.rss / 1024 / 1024),
      },
    };
  });
}
