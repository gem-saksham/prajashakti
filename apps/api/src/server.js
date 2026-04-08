import 'dotenv/config';
import { buildApp } from './app.js';
import { closePool } from './db/postgres.js';
import redis from './db/redis.js';
import { runSecurityChecks } from './utils/securityCheck.js';

// ─── Security checks (exits if misconfigured in production) ───────────────────

runSecurityChecks();

// ─── Build app ────────────────────────────────────────────────────────────────

const fastify = await buildApp();

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const shutdown = async (signal) => {
  fastify.log.warn(`[server] ${signal} received — shutting down`);
  await fastify.close();
  await closePool();
  await redis.quit();
  fastify.log.warn('[server] shutdown complete');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Start ────────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

await fastify.listen({ port, host });

console.info(`
┌─────────────────────────────────────────┐
│                                         │
│   प्रजाशक्ति API Server  v1               │
│   http://${host}:${port}/api/v1/status  │
│   Env: ${(process.env.NODE_ENV || 'development').padEnd(31)}│
│                                         │
└─────────────────────────────────────────┘`);

export default fastify;
