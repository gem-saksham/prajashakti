import Redis from 'ioredis';

// ─── Key Patterns (reference) ─────────────────────────────────────────────────
//
//  otp:{phone}                 → OTP code                (TTL: 300s)
//  session:{userId}            → JWT token               (TTL: 7d)
//  user:{userId}               → cached user object      (TTL: 300s)
//  issue:supporters:{issueId}  → sorted set of supporter user IDs
//  issue:count:{issueId}       → supporter count cache   (TTL: 60s)
//  feed:user:{userId}          → cached feed             (TTL: 60s)
//  feed:district:{district}    → cached district feed    (TTL: 300s)
//  trending:global             → sorted set of trending issue IDs
//  rate:otp:{phone}            → OTP request counter     (TTL: 3600s)
//  rate:comment:{userId}       → comment counter         (TTL: 3600s)
//
// ─────────────────────────────────────────────────────────────────────────────

// In test mode, use Redis database index 1 to isolate test keys from dev data.
const redisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  ...(process.env.NODE_ENV === 'test' && { db: 1 }),
};

const redis = new Redis(process.env.REDIS_URL, redisOptions);

redis.on('connect', () => console.info('[redis] connected'));
redis.on('error', (err) => console.error('[redis] error', err));

// ─── Health Check ─────────────────────────────────────────────────────────────
export async function checkHealth() {
  const pong = await redis.ping();
  return pong === 'PONG';
}

export default redis;
