# Sprint 1 Retrospective

**Sprint:** 1 (Days 1–15)  
**Date:** 2026-04-08  
**Duration:** 15 days  
**Team:** Solo (Platform Engineering)

---

## What We Built

Sprint 1 delivered the complete authentication and identity foundation for PrajaShakti:

- **Monorepo scaffold** — Fastify API, React web, Expo mobile, shared lint/hooks
- **CI/CD pipeline** — GitHub Actions for lint, test, Docker build
- **Phone-OTP authentication** — register, login, verify, refresh, logout
- **JWT token rotation** — access tokens (15m), refresh tokens (30d) with family-based reuse detection
- **User profiles** — full CRUD, avatar upload (web direct + mobile proxy), location fields
- **Location services** — IP detection, reverse geocoding, autocomplete (Nominatim)
- **Security hardening** — rate limiting, OTP lockout, input sanitisation, Helmet CSP, audit logging
- **Infrastructure** — Docker Compose, LocalStack (S3), PostgreSQL, Redis, migrations
- **Test suite** — 81 tests, all passing (unit + integration + security)
- **Documentation** — API docs, security model, QA checklist, this retrospective

---

## What Went Well

### Architecture Decisions

**Service layer pattern paid off immediately.** Separating routes from business logic meant security fixes (moving cooldown checks after conflict checks) were surgical — one file, no cascade. Every test hits the service through the route, so integration tests are real.

**Redis as the source of truth for ephemeral state** (OTPs, rate limits, sessions, cache) worked perfectly. No database polling, instant TTL-based expiry, no cron jobs to clean up expired OTPs.

**Media proxy pattern solved a real production-class problem.** On Day 13, mobile could upload but couldn't display avatars — LocalStack port 4566 was unreachable from LAN devices. The proxy routes (`/me/avatar` for upload, `/api/v1/media/*` for display) fixed it cleanly without any mobile-side changes.

**Token family tracking** was a good early investment. When a rotated token is replayed, we can revoke the entire login session across all devices. This would have been painful to retrofit later.

**Schema-based selective sanitisation** avoided a class of bugs. Escaping all strings indiscriminately would have broken MIME type validation (`image/jpeg` → `image&#x2F;jpeg`). The explicit-field approach is slower to set up but much safer.

### Process

**Dogfooding the QA checklist on Day 15** caught 14 bugs before sprint close — a good return on a 3-hour investment. The bugs were mostly field name mismatches between API model and mobile screens, exactly the kind of thing automated tests miss.

**Writing tests alongside bugs** (rather than fixing the bug and moving on) gave us 81 green tests at sprint close. Each bug fix has a regression test.

---

## What Didn't Go Well

### Estimates vs Reality

Feature work took roughly the expected time. Security hardening (Day 14) took significantly longer — about 2× estimated. The JSdom/ESM conflict in Jest alone cost several hours of debugging.

### Technical Friction

**Jest + Fastify + ESM** is a painful combination. `--experimental-vm-modules`, dynamic `import()` for jsdom, `jest.config.cjs` — the setup is fragile. We should consider switching to Vitest for Sprint 2.

**Node-pg-migrate's `default` syntax** is not obvious. `default: "'{}'"` is invalid; `default: pgm.func("'{}'::jsonb")` is required. This is not in the top-level docs. Cost ~30 minutes.

**Windows Firewall and mobile dev** — port 4566 (LocalStack) is blocked on LAN by default on Windows. Mobile dev requires the proxy workaround. We documented this, but it will be a speedbump for any new contributor.

### Technical Debt Created

See [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) for the full list. Key items:

1. `securityCheck.js` is not imported in test mode — 0% coverage, not exercised in CI
2. Aadhaar verification is a stub (returns `"coming soon"`)
3. OTP provider is `console.log` in dev — no real SMS integration yet
4. Avatar upload doesn't crop/compress — large files go straight to S3
5. Profile completeness dismissal not persisted across reloads

---

## Lessons for Sprint 2

1. **Write the integration test before the feature.** We retrofitted tests onto bugs several times. Test-first would have caught the field name mismatches before they became bugs.

2. **Mobile needs its own dev environment notes.** The proxy setup, Expo dev host detection, and Windows Firewall workarounds should be in a `docs/DEV_MOBILE.md`.

3. **Keep migrations in a numbered sequence and never edit a committed migration.** The `'{}` default bug could have been caught with a migration test that runs against a fresh DB in CI.

4. **Consider Vitest over Jest.** ESM support is first-class, it's faster, and the API is compatible enough that migration should be low-effort.

5. **Plan for PII handling early.** The DPDP Act (India's privacy law) will require us to log what personal data we store and provide deletion flows. Sprint 2 should add a `DELETE /me` endpoint.

---

## Metrics

| Metric                | Value          |
| --------------------- | -------------- |
| Days                  | 15             |
| New files             | ~80            |
| Test cases            | 81             |
| Test pass rate        | 100%           |
| Bugs found in QA      | 14 (all fixed) |
| Bugs deferred         | 5 (all P2)     |
| API endpoints         | 18             |
| Migrations            | 10             |
| Coverage (statements) | 59%            |
| Coverage (functions)  | 64%            |

---

## Sprint 2 Preview

Sprint 2 begins Day 16. The primary theme is **Issues** — the core content type of PrajaShakti.

See [SPRINT_2_KICKOFF.md](../SPRINT_2_KICKOFF.md) for the full plan.
