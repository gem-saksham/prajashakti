export default async function healthRoutes(fastify) {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'prajashakti-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    };
  });
}
