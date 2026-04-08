# Production Readiness Checklist

Items to complete before deploying PrajaShakti to production. Updated each sprint.

**Legend:** ✅ Ready · ⚠️ Partial · ❌ Not done · 🔵 Planned

---

## Infrastructure

| #   | Item                                | Status | Notes                                              |
| --- | ----------------------------------- | ------ | -------------------------------------------------- |
| 1   | PostgreSQL hosted (not localhost)   | ❌     | Use RDS, Neon, or Supabase                         |
| 2   | Redis hosted (not localhost)        | ❌     | Use ElastiCache or Upstash                         |
| 3   | S3 bucket (not LocalStack)          | ❌     | Real AWS S3 with lifecycle policies                |
| 4   | API server with TLS                 | ❌     | Behind nginx + Let's Encrypt                       |
| 5   | CDN for static assets               | ❌     | CloudFront or Cloudflare                           |
| 6   | Health check wired to load balancer | ✅     | `GET /api/health` returns 200/500                  |
| 7   | Database connection pooling         | ✅     | `pg.Pool` with `max: 10`                           |
| 8   | Redis connection with TLS           | ❌     | `rediss://` URL in production                      |
| 9   | Secrets in environment (not code)   | ✅     | All secrets via env vars                           |
| 10  | Docker images tagged by commit SHA  | ⚠️     | CI builds on push, tags not yet pushed to registry |

---

## Security

| #   | Item                                  | Status | Notes                                       |
| --- | ------------------------------------- | ------ | ------------------------------------------- |
| 11  | JWT_SECRET ≥ 64 random chars          | ✅     | Startup check enforces this                 |
| 12  | CORS restricted to production domain  | ✅     | Callback checks `prajashakti.in`            |
| 13  | Helmet CSP enabled                    | ✅     | Enabled in `isProd` only                    |
| 14  | HTTPS-only (HSTS enabled)             | ✅     | `maxAge: 31536000, preload: true` in isProd |
| 15  | SQL injection prevention              | ✅     | Parameterised queries throughout            |
| 16  | XSS prevention                        | ✅     | DOMPurify + validator.escape per field      |
| 17  | Rate limiting on auth endpoints       | ✅     | 10/min per IP, 5 OTPs/hour per phone        |
| 18  | OTP lockout after failed attempts     | ✅     | 3 attempts → 15-min lock                    |
| 19  | Token rotation (refresh)              | ✅     | Single-use, family revocation               |
| 20  | Token blacklist on logout             | ✅     | Redis-backed with TTL                       |
| 21  | Secret redaction in logs              | ✅     | `redactSensitive()` in logger               |
| 22  | Path traversal blocked on media proxy | ✅     | Prefix allowlist enforced                   |
| 23  | Audit log for security events         | ✅     | `audit_log` table populated                 |
| 24  | OTP provider uses real SMS            | ❌     | Still console.log in dev                    |
| 25  | npm audit clean (no critical)         | ⚠️     | Run `npm audit` before deploy               |

---

## Observability

| #   | Item                                 | Status | Notes                      |
| --- | ------------------------------------ | ------ | -------------------------- |
| 26  | Structured JSON logs                 | ✅     | Pino JSON in production    |
| 27  | Request ID on every request          | ✅     | `X-Request-ID` header      |
| 28  | Error tracking (Sentry / equivalent) | ❌     | Not integrated             |
| 29  | Uptime monitoring                    | ❌     | BetterUptime / Pingdom TBD |
| 30  | Log aggregation                      | ❌     | CloudWatch / Loki TBD      |
| 31  | Alerts on 5xx error rate             | ❌     | Needs monitoring first     |
| 32  | Slow query logging                   | ❌     | Add `pg` query timing      |

---

## Data & Compliance

| #   | Item                                 | Status | Notes                                                            |
| --- | ------------------------------------ | ------ | ---------------------------------------------------------------- |
| 33  | Database migrations run on deploy    | ✅     | `npm run migrate:up` in CI                                       |
| 34  | Database backups scheduled           | ❌     | RDS automated backups or pg_dump cron                            |
| 35  | PII audit (what data we store)       | ⚠️     | Phone, name, bio, location — documented but not formally audited |
| 36  | Account deletion flow (`DELETE /me`) | ❌     | Required by DPDP Act                                             |
| 37  | Privacy policy published             | ❌     | Legal draft needed                                               |
| 38  | Terms of service published           | ❌     | Legal draft needed                                               |
| 39  | Cookie consent (web)                 | 🔵     | Not needed until we add cookies beyond JWT                       |
| 40  | Data retention policy                | ❌     | Audit log and activity data retention TBD                        |

---

## Performance

| #   | Item                            | Status | Notes                                |
| --- | ------------------------------- | ------ | ------------------------------------ |
| 41  | Database indexes on hot paths   | ✅     | idx*users_phone, idx_issues*\*, etc. |
| 42  | Redis caching for profile/stats | ✅     | 5-min TTL                            |
| 43  | Avatar crop/compression         | ❌     | TD-04                                |
| 44  | Static assets served from CDN   | ❌     | Vite build goes to CDN               |
| 45  | API response compression (gzip) | ❌     | Add `@fastify/compress`              |

---

## CI/CD

| #   | Item                              | Status | Notes                            |
| --- | --------------------------------- | ------ | -------------------------------- |
| 46  | Lint passes on PR                 | ✅     | GitHub Actions                   |
| 47  | Tests pass on PR                  | ✅     | GitHub Actions                   |
| 48  | Docker image builds on PR         | ✅     | GitHub Actions                   |
| 49  | Image pushed to registry on merge | ❌     | Need registry (ECR / GHCR)       |
| 50  | Auto-deploy to staging on merge   | ❌     | Deployment target TBD            |
| 51  | Zero-downtime deploy strategy     | ❌     | Rolling update or blue/green TBD |
| 52  | Rollback procedure documented     | ❌     | Git tag + migration rollback     |

---

## Mobile App

| #   | Item                              | Status | Notes                                          |
| --- | --------------------------------- | ------ | ---------------------------------------------- |
| 53  | Expo production build configured  | ⚠️     | `app.json` has bundle IDs but not signing keys |
| 54  | API base URL points to production | ❌     | Currently hardcoded to localhost               |
| 55  | App Store / Play Store listing    | ❌     | Not started                                    |
| 56  | Push notifications infrastructure | ❌     | Expo Notifications + FCM TBD                   |
| 57  | Deep linking configured           | ❌     | Needed for magic links / Aadhaar redirect      |

---

## Launch Blocklist

These items **must** be complete before production launch:

- [ ] Real SMS OTP provider (TD-02)
- [ ] Hosted Postgres + Redis
- [ ] Real S3 bucket
- [ ] TLS / HTTPS
- [ ] Account deletion (`DELETE /me`)
- [ ] Privacy policy + Terms of service
- [ ] `npm audit` clean

---

_Last updated: Sprint 1 close (2026-04-08)_
