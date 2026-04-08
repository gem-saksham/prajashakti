/**
 * Security Checks — run on startup, refuse to start if misconfigured.
 *
 * In production, the API will exit(1) if any hard requirement is unmet.
 * In development/test, requirements are relaxed but warnings are printed.
 */

export function runSecurityChecks() {
  const errors = [];
  const warnings = [];
  const isProd = process.env.NODE_ENV === 'production';

  // ── JWT Secret ─────────────────────────────────────────────────────────────
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    errors.push('JWT_SECRET is not set');
  } else if (jwtSecret === 'dev-secret-change-me' || jwtSecret === 'change-me-in-production') {
    if (isProd) {
      errors.push('JWT_SECRET is still set to a default placeholder — change it!');
    } else {
      warnings.push('JWT_SECRET is using a dev placeholder — change it before production deploy');
    }
  } else if (isProd && jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }

  // ── Database ───────────────────────────────────────────────────────────────
  if (isProd) {
    const dbUrl = process.env.DATABASE_URL ?? '';
    if (!dbUrl) {
      errors.push('DATABASE_URL is not set');
    } else if (!dbUrl.includes('sslmode=require') && !dbUrl.includes('ssl=true')) {
      errors.push('DATABASE_URL must use SSL in production (add ?sslmode=require)');
    }
  }

  // ── Redis ──────────────────────────────────────────────────────────────────
  if (isProd) {
    const redisUrl = process.env.REDIS_URL ?? '';
    if (!redisUrl) {
      errors.push('REDIS_URL is not set');
    } else if (!redisUrl.startsWith('rediss://')) {
      warnings.push('REDIS_URL is not using TLS (rediss://). Recommended in production.');
    }
  }

  // ── OTP Provider ──────────────────────────────────────────────────────────
  if (isProd) {
    if (process.env.OTP_PROVIDER === 'console') {
      errors.push('OTP_PROVIDER is set to "console" in production — set it to "msg91"');
    }
    if (!process.env.MSG91_AUTH_KEY) {
      errors.push('MSG91_AUTH_KEY is required in production');
    }
  }

  // ── Access token lifetime ──────────────────────────────────────────────────
  const jwtExpiry = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
  if (isProd && (jwtExpiry === '7d' || jwtExpiry === '1d')) {
    warnings.push(
      `JWT_ACCESS_EXPIRES_IN is set to ${jwtExpiry} — recommended ≤ 15m for rotation security`,
    );
  }

  // ── Output ─────────────────────────────────────────────────────────────────
  warnings.forEach((w) => console.warn(`  ⚠  ${w}`));

  if (errors.length > 0) {
    console.error('\n✗ SECURITY CHECK FAILED — server will not start:');
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    console.error('');
    process.exit(1);
  }

  if (warnings.length === 0) {
    console.info('✓ Security checks passed');
  } else {
    console.info('✓ Security checks passed (with warnings above)');
  }
}
