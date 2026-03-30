import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import healthRoutes from './routes/health.js';
import userRoutes from './routes/users.js';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// ─── Plugins ───
await fastify.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? ['https://prajashakti.in'] : true,
  credentials: true,
});

await fastify.register(helmet);

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  sign: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
});

// ─── Auth decorator ───
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
});

// ─── Routes ───
await fastify.register(healthRoutes, { prefix: '/api' });
await fastify.register(userRoutes, { prefix: '/api/users' });

// ─── Start ───
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port, host });
    console.info(`
    ┌─────────────────────────────────────────┐
    │                                         │
    │   प्रजाशक्ति API Server                    │
    │   Running on http://${host}:${port}        │
    │   Environment: ${process.env.NODE_ENV || 'development'}            │
    │                                         │
    └─────────────────────────────────────────┘
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;
