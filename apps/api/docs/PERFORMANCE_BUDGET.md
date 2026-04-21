# API Performance Budget — PrajaShakti Issue Engine

Performance targets for every Sprint 2 endpoint.
P50 / P95 / P99 measured under realistic load (200 concurrent users, seed dataset of 500 issues / 10k supports).

All targets assume Redis cache warm (steady-state production).
"Cold" means first request after server restart or cache eviction.

---

## Issue Endpoints

| Endpoint                            | P50    | P95    | P99    | Notes                               |
| ----------------------------------- | ------ | ------ | ------ | ----------------------------------- |
| `GET /issues` (cached)              | <50ms  | <150ms | <400ms | Redis list cache key                |
| `GET /issues` (cold)                | <200ms | <500ms | <1s    | DB query + pagination               |
| `GET /issues?category=X` (filtered) | <100ms | <300ms | <600ms | `idx_issues_status_cat_created`     |
| `GET /issues?district=X&state=Y`    | <100ms | <300ms | <600ms | `idx_issues_district_state_created` |
| `GET /issues/nearby`                | <200ms | <500ms | <1s    | PostGIS ST_DWithin + GiST           |
| `GET /issues/bbox`                  | <150ms | <400ms | <800ms | ST_MakeEnvelope                     |
| `GET /issues/stats`                 | <50ms  | <150ms | <400ms | Redis cached, expires 60s           |
| `GET /issues/jurisdiction`          | <150ms | <400ms | <800ms | JOIN with states/districts          |
| `GET /issues/:id`                   | <100ms | <300ms | <600ms | `issues_pkey` + joins               |
| `POST /issues`                      | <500ms | <1s    | <2s    | Insert + geocode (if needed)        |
| `PATCH /issues/:id`                 | <200ms | <500ms | <1s    | Single row update                   |
| `DELETE /issues/:id`                | <100ms | <300ms | <600ms | Soft delete (status = 'closed')     |

## Support Endpoints

| Endpoint                        | P50    | P95    | P99    | Notes                     |
| ------------------------------- | ------ | ------ | ------ | ------------------------- |
| `POST /issues/:id/support`      | <100ms | <250ms | <500ms | Transaction + Redis write |
| `DELETE /issues/:id/support`    | <100ms | <250ms | <500ms | Transaction + Redis write |
| `GET /issues/:id/supporters`    | <50ms  | <150ms | <400ms | Redis cache 2min          |
| `GET /issues/:id/support-stats` | <50ms  | <150ms | <400ms | Redis counter + velocity  |
| `GET /users/:id/supported`      | <100ms | <300ms | <600ms | No cache                  |

## Tag Suggestion & Officials

| Endpoint                     | P50    | P95    | P99    | Notes                   |
| ---------------------------- | ------ | ------ | ------ | ----------------------- |
| `POST /issues/suggest-tags`  | <300ms | <800ms | <1.5s  | Redis cache 10min       |
| `GET /officials`             | <100ms | <300ms | <600ms | pg_trgm search          |
| `POST /issues/:id/officials` | <100ms | <250ms | <500ms | Insert + conflict check |

## Location Endpoints

| Endpoint                                | P50    | P95    | P99    | Notes                     |
| --------------------------------------- | ------ | ------ | ------ | ------------------------- |
| `GET /location/states`                  | <30ms  | <100ms | <200ms | Redis cache 24h           |
| `GET /location/states/:code/districts`  | <30ms  | <100ms | <200ms | Redis cache 24h           |
| `GET /location/jurisdiction`            | <400ms | <1s    | <2s    | Nominatim + DB enrichment |
| `GET /location/responsible-departments` | <300ms | <800ms | <1.5s  | Redis cache 1h            |

## Auth Endpoints

| Endpoint                 | P50    | P95    | P99    | Notes                 |
| ------------------------ | ------ | ------ | ------ | --------------------- |
| `POST /users/register`   | <100ms | <300ms | <500ms | DB insert + OTP       |
| `POST /users/verify-otp` | <100ms | <300ms | <500ms | OTP verify + JWT sign |
| `POST /users/refresh`    | <50ms  | <150ms | <300ms | Redis token lookup    |
| `GET /users/me`          | <50ms  | <150ms | <300ms | Redis user cache      |

---

## Exceeding Budget — Escalation

If any endpoint consistently exceeds P95 target under load:

1. Check `pg_stat_statements` for slow queries (see `SLOW_QUERIES.md`)
2. Run `EXPLAIN (ANALYZE, BUFFERS)` on the offending query
3. Consider: missing index, N+1 query, missing Redis cache layer
4. File a P1 bug in backlog with query plan attached

---

## Load Test Commands

```bash
# Prerequisites: API running on localhost:3000 with realistic seed data
npm run seed:realistic   # 200 users, 500 issues, 10k supports

# Run each scenario
npx artillery run tests/load/issue-creation.yml -o results-creation.json
npx artillery run tests/load/issue-list.yml     -o results-list.json
npx artillery run tests/load/support-spike.yml  -o results-spike.json

# Generate HTML report
npx artillery report results-creation.json
npx artillery report results-list.json
npx artillery report results-spike.json
```

## Baseline Measurements (Day 22, test DB, seed dataset TBD)

| Scenario                        | P50 | P95 | P99 | Error% |
| ------------------------------- | --- | --- | --- | ------ |
| Issue creation (50 VUs, 70s)    | TBD | TBD | TBD | TBD    |
| Issue list read (200 VUs, 150s) | TBD | TBD | TBD | TBD    |
| Support spike (1000 VUs, 60s)   | TBD | TBD | TBD | TBD    |

_Baseline to be filled in after running load tests against the realistic seed dataset (Sprint 3)._
