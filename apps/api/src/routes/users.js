// User routes — Day 1 scaffold (full implementation in Days 6-7)
// Endpoints defined here, business logic will be added as we build

export default async function userRoutes(fastify) {
  // POST /api/users/register — Start registration with phone number
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'name'],
        properties: {
          phone: { type: 'string', pattern: '^[6-9]\\d{9}$' },
          name: { type: 'string', minLength: 2, maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      const { phone, name } = request.body;

      // TODO (Day 6): Send OTP via MSG91, store in Redis
      // For now, return mock response
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.info(`[DEV] OTP for ${phone}: ${otp}`);

      // TODO: Store OTP in Redis with TTL
      // await redis.setex(`otp:${phone}`, 300, otp);

      return reply.status(200).send({
        success: true,
        message: 'OTP sent successfully',
        // Only in dev mode — remove in production
        ...(process.env.NODE_ENV !== 'production' && { debug_otp: otp }),
      });
    },
  });

  // POST /api/users/verify-otp — Verify OTP and complete registration
  fastify.post('/verify-otp', {
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'otp'],
        properties: {
          phone: { type: 'string', pattern: '^[6-9]\\d{9}$' },
          otp: { type: 'string', pattern: '^\\d{6}$' },
        },
      },
    },
    handler: async (request, reply) => {
      const { phone, otp } = request.body;

      // TODO (Day 6): Verify OTP from Redis, create/find user in PostgreSQL
      // const storedOtp = await redis.get(`otp:${phone}`);
      // if (storedOtp !== otp) return reply.status(400).send({ error: 'Invalid OTP' });

      // Mock user for scaffolding
      const user = {
        id: 'usr_' + Date.now(),
        phone,
        name: 'New User',
        role: 'citizen',
        reputation_score: 0,
        created_at: new Date().toISOString(),
      };

      const token = fastify.jwt.sign({ id: user.id, phone: user.phone, role: user.role });

      return reply.status(200).send({
        success: true,
        user,
        token,
      });
    },
  });

  // POST /api/users/login — Login with phone (sends OTP)
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string', pattern: '^[6-9]\\d{9}$' },
        },
      },
    },
    handler: async (request, reply) => {
      const { phone } = request.body;

      // TODO (Day 6): Check if user exists, send OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.info(`[DEV] Login OTP for ${phone}: ${otp}`);

      return reply.status(200).send({
        success: true,
        message: 'OTP sent',
        ...(process.env.NODE_ENV !== 'production' && { debug_otp: otp }),
      });
    },
  });

  // GET /api/users/me — Get current user profile (authenticated)
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const { id } = request.user;

      // TODO (Day 8): Fetch from PostgreSQL
      return reply.status(200).send({
        id,
        phone: request.user.phone,
        name: 'PrajaShakti User',
        bio: null,
        avatar_url: null,
        location: null,
        district: null,
        state: null,
        role: request.user.role,
        reputation_score: 0,
      });
    },
  });

  // PATCH /api/users/me — Update profile (authenticated)
  fastify.patch('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          bio: { type: 'string', maxLength: 500 },
          avatar_url: { type: 'string', format: 'uri' },
          district: { type: 'string' },
          state: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.user;
      const updates = request.body;

      // TODO (Day 8): Update in PostgreSQL
      return reply.status(200).send({
        success: true,
        message: 'Profile updated',
        updated_fields: Object.keys(updates),
      });
    },
  });
}
