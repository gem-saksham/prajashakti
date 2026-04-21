# प्रजाशक्ति — PrajaShakti

**Power of the Citizens**

> यत्र प्रजाशक्तिः तत्र सुशासनम्  
> _"Where there is the power of citizens, there is good governance"_

A civic engagement platform for India. Citizens raise issues, rally support, and hold officials accountable.

---

## What Is This?

PrajaShakti connects citizens in real time to collectively identify public issues, pressure government officials and bureaucrats, and demand accountability. The platform takes micro-donations (as low as ₹1/day), uses a portion for operating costs to stay fully self-sufficient, and donates the rest to randomly selected 80G-certified non-profits. All bank statements are public. No government, political, or corporate funding — ever.

**Framework:** इच्छा (Desire) → ज्ञान (Knowledge) → क्रिया (Action)

---

## Monorepo Structure

```
prajashakti-mono/
├── apps/
│   ├── api/              ← Fastify backend (Node.js + PostgreSQL + Redis)
│   ├── web/              ← React + Vite (PWA)
│   └── mobile/           ← React Native + Expo (Android/iOS)
├── docs/
│   ├── API.md            ← API reference
│   ├── SECURITY.md       ← Security model + incident response
│   ├── TECHNICAL_DEBT.md ← Known issues + future work
│   ├── PRODUCTION_CHECKLIST.md
│   ├── SPRINT_1_QA.md
│   ├── SPRINT_2_KICKOFF.md
│   ├── SPRINT_2_QA.md
│   ├── SPRINT_2_COVERAGE.md
│   ├── SPRINT_3_KICKOFF.md
│   └── retrospectives/
│       ├── SPRINT_1.md
│       └── SPRINT_2.md
├── scripts/
│   ├── db/               ← DB seed scripts
│   └── localstack/       ← LocalStack init (S3 bucket creation)
├── .github/workflows/    ← CI/CD (lint, test, Docker)
├── docker-compose.yml    ← Full local stack
└── package.json          ← Workspace root
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- Docker + Docker Compose
- (Mobile) Expo Go app on your device, or an Android/iOS emulator

### 1. Clone and install

```bash
git clone https://github.com/gem-saksham/prajashakti-mono.git
cd prajashakti-mono
npm install
```

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — defaults work for local development
```

### 3. Start the full stack

```bash
docker compose up -d   # PostgreSQL + Redis + LocalStack
npm run dev            # API (port 3000) + Web (port 5173)
```

### 4. Run database migrations

```bash
cd apps/api && npm run migrate:up
```

### 5. Open the app

- **Web:** http://localhost:5173
- **API:** http://localhost:3000
- **API docs (Swagger):** http://localhost:3000/api/docs
- **Mobile:** `cd apps/mobile && npx expo start`

---

## Scripts

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `npm run dev`        | Start API + Web concurrently   |
| `npm run dev:api`    | Start Fastify API only         |
| `npm run dev:web`    | Start Vite dev server only     |
| `npm run dev:mobile` | Start Expo dev server          |
| `npm test`           | Run all tests                  |
| `npm run lint`       | Run ESLint across all packages |
| `npm run format`     | Format with Prettier           |

### API-specific

```bash
cd apps/api
npm test                  # Jest test suite (470 tests)
npm run test:coverage     # Coverage report
npm run migrate:up        # Run pending migrations
npm run migrate:down      # Roll back last migration
npm run migrate:create -- name-of-migration
```

---

## Tech Stack

| Layer            | Technology                                                    |
| ---------------- | ------------------------------------------------------------- |
| API              | Fastify 5, @fastify/jwt, @fastify/rate-limit, @fastify/helmet |
| Database         | PostgreSQL 16 (via `pg` + `node-pg-migrate`)                  |
| Cache / Sessions | Redis 7 (via `ioredis`)                                       |
| Object Storage   | AWS S3 (LocalStack in dev, real S3 in prod)                   |
| Web              | React 18, Vite 5                                              |
| Mobile           | React Native 0.81, Expo SDK 54, React Navigation              |
| Auth             | Phone OTP + JWT (access 15m + refresh 30d with rotation)      |
| CI/CD            | GitHub Actions                                                |
| Containers       | Docker + Docker Compose                                       |

---

## Sprint Progress

### Sprint 1 — Authentication & Identity Foundation (Days 1–15) ✅

- [x] Day 1: Monorepo scaffold — Fastify API, React web, Expo mobile, linting, hooks
- [x] Day 2: GitHub Actions CI/CD — lint, test, Docker build
- [x] Day 3: Docker Compose full stack + LocalStack S3
- [x] Day 4: Database schema + migrations (users, activity, audit log)
- [x] Day 5: Phone OTP authentication (register, login, verify-otp)
- [x] Day 6: JWT tokens (access + refresh rotation with family tracking)
- [x] Day 7: User profile API (CRUD, avatar upload, location fields)
- [x] Day 8: Location services (IP detection, reverse geocoding, autocomplete)
- [x] Day 9: Web authentication flow (register → OTP → dashboard)
- [x] Day 10: Web profile management (edit, avatar upload, location)
- [x] Day 11: Mobile authentication flow
- [x] Day 12: Mobile profile management
- [x] Day 13: Avatar upload fixes (media proxy for LAN devices)
- [x] Day 14: Security hardening (rate limiting, input sanitisation, Helmet CSP, audit logging)
- [x] Day 15: Sprint 1 QA — 81 tests passing, 14 bugs fixed, docs complete

**Sprint 1 QA: APPROVED ✅ — 81/81 tests passing**

### Sprint 2 — Issue Engine (Days 16–30) ✅

- [x] Day 16: Issue data model + CPGRAMS taxonomy (ministries, departments, grievance categories)
- [x] Day 17: Issue CRUD API (create, read, list, update, soft-delete, stats, nearby, jurisdiction, bbox)
- [x] Day 18: Multi-photo upload pipeline with EXIF GPS verification
- [x] Day 19: Officials directory (CRUD, jurisdiction search, tag/untag to issues)
- [x] Day 20: Support system with weighted votes + atomic Redis/Postgres counters
- [x] Day 21: Anti-gaming service (velocity spikes, IP/UA concentration) + tag suggestion service
- [x] Day 22: Security regression (63 tests — IDOR, SQLi, XSS, mass-assignment, geo bounds), docs, realistic seed (200 users / 503 issues / 6,013 supports)
- [x] Day 23: Ranked feed API — `GET /api/v1/feed` with modes trending/latest/critical/nearby (pulled forward from Sprint 3)
- [x] Days 24–26: Web issue creation wizard, list with URL-synced filters, detail page with gallery + map + timeline
- [x] Day 27: Mobile photo-first issue creation with offline draft queue
- [x] Day 28: Mobile native UX — pull-to-refresh haptics, swipe actions, pinch-zoom gallery, deep links, offline cache + queued supports
- [x] Day 30: Sprint 2 QA — 470/470 tests green, 67.16% statement coverage, 0 P0/P1 bugs, 8 P2 items deferred to Sprint 3

**Sprint 2 QA: APPROVED ✅ — 470/470 tests passing, 32 new endpoints, 8 new tables, zero P0/P1 bugs**

See [docs/retrospectives/SPRINT_2.md](docs/retrospectives/SPRINT_2.md) and [docs/SPRINT_2_QA.md](docs/SPRINT_2_QA.md).

### Sprint 3 — The Feed (Days 31–45) 🔵 Starting Day 31

See [docs/SPRINT_3_KICKOFF.md](docs/SPRINT_3_KICKOFF.md) for the plan.

---

## Architecture Notes

### Authentication Flow

```
POST /register → OTP sent → POST /verify-otp → { accessToken (15m), refreshToken (30d) }
POST /login    → OTP sent → POST /verify-otp → same
POST /refresh  → new accessToken + new refreshToken (rotation — old token invalidated)
POST /logout   → accessToken blacklisted + refreshToken revoked
```

### Security Model

See [docs/SECURITY.md](docs/SECURITY.md) for the full threat model and security measures.

Key protections:

- Rate limiting: 5 OTPs/hour per phone, 3 failed attempts → 15-minute lockout
- Token rotation: each refresh token is single-use; reuse triggers full session revocation
- Input sanitisation: HTML entities escaped in all free-text fields
- Audit logging: all auth events written to `audit_log` table
- Startup security checks: refuses to start in production with weak/missing secrets

### Mobile Avatar Upload

Mobile devices in development cannot reach LocalStack (port 4566 is blocked by Windows Firewall on LAN). Solution:

- **Upload:** `POST /api/v1/users/me/avatar` — mobile sends raw bytes to API → API uploads to S3
- **Display:** `GET /api/v1/media/avatars/*` — API proxies S3 object to device

The same proxy pattern is used for issue evidence photos (Sprint 2) and any future media.

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feature/my-feature`
2. Follow the existing code style (ESLint + Prettier enforced via pre-commit hook)
3. Write tests for new functionality — keep coverage above 60%
4. Open a PR with a clear description of what changed and why

### Code Conventions

- **API:** Service layer for business logic, routes only for HTTP concerns
- **Errors:** Throw `ServiceError(statusCode, code, message)` from services; route catches and forwards
- **Security:** Never log PII; use `redactSensitive()` for any object that might contain secrets
- **Tests:** Integration tests hit real Postgres + Redis (no mocks); unit tests for pure logic

---

## Environment Variables

See `apps/api/.env.example` for all variables. Key ones:

| Variable       | Required | Description                           |
| -------------- | -------- | ------------------------------------- |
| `DATABASE_URL` | Yes      | PostgreSQL connection string          |
| `REDIS_URL`    | Yes      | Redis connection string               |
| `JWT_SECRET`   | Yes      | Min 64 chars in production            |
| `AWS_*`        | Yes      | S3 credentials (LocalStack in dev)    |
| `OTP_PROVIDER` | No       | `console` (dev) or `msg91` (prod)     |
| `NODE_ENV`     | No       | `development` / `test` / `production` |

---

_इच्छा → ज्ञान → क्रिया_  
_Desire → Knowledge → Action_
