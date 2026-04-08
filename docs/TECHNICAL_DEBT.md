# Technical Debt Registry

Items to address in future sprints. Each entry has a severity (High / Medium / Low), origin sprint, and suggested sprint for resolution.

---

## High Priority

### TD-01 — securityCheck.js has 0% test coverage

**Sprint:** 1  
**Target:** Sprint 2  
The startup security check (`src/utils/securityCheck.js`) calls `process.exit(1)` on misconfiguration in production. It is explicitly excluded from the test app startup, so CI never exercises it. A bad import or logic error could silently skip checks at production startup.

**Fix:** Add a dedicated test that stubs `process.exit` and exercises each check with invalid/valid env vars.

---

### TD-02 — OTP provider is console.log only

**Sprint:** 1  
**Target:** Sprint 2  
`src/services/otpProvider.js` logs the OTP to console in dev and is a no-op placeholder for production. No real SMS gateway is wired.

**Fix:** Integrate MSG91 (or Twilio as fallback) behind the existing `sendOtp(phone, otp)` interface. Add `OTP_PROVIDER=msg91` env var with API key. Keep console provider for `NODE_ENV=development`.

---

### TD-03 — Aadhaar verification is a stub

**Sprint:** 1  
**Target:** Sprint 3  
`POST /verify-aadhaar` returns `"coming soon"`. The `is_verified` flag in the DB is never set to `true` through the app.

**Fix:** Integrate DigiLocker or a KYC provider. Until then, the Settings UI should not show Aadhaar as an option.

---

## Medium Priority

### TD-04 — Avatar upload: no crop/compression

**Sprint:** 1  
**Target:** Sprint 2  
Images go to S3 at full resolution. A 12MP phone photo is ~8MB. This will cause slow uploads and high S3 storage costs at scale.

**Fix:** Compress and resize to max 800×800px before upload. Web: use `canvas.toBlob()`. Mobile: use `expo-image-manipulator`.

---

### TD-05 — Profile completeness dismissal not persisted

**Sprint:** 1  
**Target:** Sprint 2  
When a user dismisses the "complete your profile" suggestions card, it reappears on next page load because the dismissed state is only in component state.

**Fix:** Add a `profile_suggestions_dismissed_at` column (or use a user preferences JSONB column) and pass it through the profile API.

---

### TD-06 — No `DELETE /me` endpoint

**Sprint:** 1  
**Target:** Sprint 2  
Users cannot delete their account. This is required by the DPDP Act (India's data protection law) and is good practice regardless.

**Fix:** Add `DELETE /me` that soft-deletes (`is_active = false`) and schedules PII erasure after a 30-day cooling-off period.

---

### TD-07 — No email verification

**Sprint:** 1  
**Target:** Sprint 3  
Users can set an email address but it is never verified. The `email_verified` column exists in the DB but is never set.

**Fix:** On `PATCH /me` with a new email, send a verification link. Mark verified on click.

---

### TD-08 — Jest + ESM is fragile

**Sprint:** 1  
**Target:** Sprint 2  
The test setup uses `--experimental-vm-modules`, a `jest.config.cjs`, and a dynamic import workaround for jsdom. This caused several hours of debugging in Sprint 1.

**Fix:** Migrate to Vitest. The API is ~90% compatible with Jest. First-class ESM support, no experimental flags, faster parallel execution.

---

### TD-09 — No pagination on user activity for large datasets

**Sprint:** 1  
**Target:** Sprint 3  
`GET /:id/activity` fetches all activity then paginates in JS. For users with thousands of activities, this will be slow.

**Fix:** Push pagination into the SQL query with `LIMIT / OFFSET` (already supported by `getPublicActivity`). Already done — verify it uses DB-level pagination, not JS slice.

---

## Low Priority

### TD-10 — OTP dev banner flashes on navigation

**Sprint:** 1  
**Target:** Sprint 2  
The yellow dev OTP banner (shows the OTP code in non-production) briefly flashes during client-side navigation on some browsers due to state timing.

**Fix:** Memoize the banner component and only render it when `debugOtp` is non-null and not empty.

---

### TD-11 — No structured logging in dev

**Sprint:** 1  
**Target:** Sprint 3  
In development, logs use pino-pretty which is not machine-parseable. CI logs are therefore noisy and not queryable.

**Fix:** Accept this in dev (pretty is good DX). In CI (`NODE_ENV=test`) we already use `level: 'silent'`. No action needed until we add a log aggregator.

---

### TD-12 — LocalStack data is ephemeral

**Sprint:** 1  
**Target:** Sprint 2  
When `docker compose down` is run, all LocalStack data (S3 buckets, uploaded avatars) is lost. The bucket is recreated on startup but uploaded files are gone.

**Fix:** Add a `localstack_data` Docker volume and mount it to `/var/lib/localstack`. Update `docker-compose.yml`.

---

### TD-13 — No request timeout on external services

**Sprint:** 1  
**Target:** Sprint 2  
Calls to Nominatim (geocoding) and ip-api.com (IP detection) have no timeout. A slow external service will hold up the request indefinitely.

**Fix:** Add `AbortSignal.timeout(5000)` to all `fetch()` calls in `locationService.js`.

---

## Resolved (Sprint 1)

All P0/P1 bugs from the Sprint 1 QA checklist are resolved. See [SPRINT_1_QA.md](SPRINT_1_QA.md) for the full bug log.
