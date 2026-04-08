# Sprint 1 QA Regression Checklist

**Date:** Day 15 — 2026-04-08  
**Tester:** Platform Engineering  
**Environment:** Local dev (Docker Compose + LocalStack)

Legend: ✅ Pass · ❌ Fail · ⚠️ Pass with caveat · 🔵 Not testable in dev env

---

## Backend API

### Authentication

| #   | Test                                                     | Status | Notes                                |
| --- | -------------------------------------------------------- | ------ | ------------------------------------ |
| 1   | GET /api/v1/status returns healthy with postgres + redis | ✅     | `{ postgres: true, redis: true }`    |
| 2   | POST /register with new phone → 200 with debug OTP       | ✅     | debug_otp returned in dev mode       |
| 3   | POST /register with existing phone → 409 CONFLICT        | ✅     | Checked before cooldown              |
| 4   | POST /register with 5-digit phone → 400 validation       | ✅     | Schema rejects it                    |
| 5   | POST /register with phone starting with 5 → 400          | ✅     | phoneSchema validates Indian numbers |
| 6   | POST /verify-otp correct OTP → 200 with tokens           | ✅     | Returns access + refresh             |
| 7   | POST /verify-otp wrong OTP → 400, counter increments     | ✅     | Remaining attempts shown             |
| 8   | POST /verify-otp 3 wrong times → lockout                 | ✅     | `otp:locked:{phone}` set for 15m     |
| 9   | POST /verify-otp expired OTP → 400                       | ✅     | Redis TTL expires OTP                |
| 10  | POST /login registered phone → 200                       | ✅     |                                      |
| 11  | POST /login unregistered phone → 404                     | ✅     |                                      |
| 12  | POST /refresh valid token → new tokens                   | ✅     | Both access+refresh rotated          |
| 13  | POST /refresh old rotated token → 401 family revoked     | ✅     | Token reuse detection                |
| 14  | POST /logout revokes refresh token                       | ✅     |                                      |

### Profile

| #   | Test                                             | Status | Notes                               |
| --- | ------------------------------------------------ | ------ | ----------------------------------- |
| 15  | GET /me with valid token → full profile          | ✅     | Includes profileCompleteness        |
| 16  | GET /me without token → 401                      | ✅     |                                     |
| 17  | GET /me with expired token → 401                 | ✅     | Auto-refresh attempted client-side  |
| 18  | PATCH /me updates allowed fields                 | ✅     | name, bio, district, state, pincode |
| 19  | PATCH /me ignores non-whitelisted fields         | ✅     | ALLOWED_PATCH_FIELDS whitelist      |
| 20  | POST /me/avatar-upload-url → pre-signed S3 URL   | ✅     | LocalStack returns valid URL        |
| 21  | Avatar upload to S3 end-to-end                   | ✅     | Web direct, mobile via API proxy    |
| 22  | DELETE /me/avatar removes avatar                 | ✅     | S3 key deleted + DB cleared         |
| 23  | GET /users/:id → public profile (no phone/email) | ✅     | PII excluded                        |
| 24  | GET /users/:id/activity → activity list          | ✅     | `{ data: [], pagination: {} }`      |

### Location

| #   | Test                                      | Status | Notes                             |
| --- | ----------------------------------------- | ------ | --------------------------------- |
| 25  | GET /location/detect → IP geolocation     | ⚠️     | Returns mock in dev; real in prod |
| 26  | GET /location/reverse → coords to address | ✅     | Nominatim API                     |
| 27  | GET /location/search → autocomplete       | ✅     |                                   |

### Media Proxy

| #   | Test                                                | Status | Notes                  |
| --- | --------------------------------------------------- | ------ | ---------------------- |
| 28  | GET /api/v1/media/avatars/:uid/:file → serves image | ✅     | 200 image/jpeg         |
| 29  | GET /api/v1/media/../../etc/passwd → 404            | ✅     | Path traversal blocked |

### Rate Limiting & Security

| #   | Test                                    | Status | Notes                         |
| --- | --------------------------------------- | ------ | ----------------------------- |
| 30  | 6th OTP request in 1 hour → 429         | ✅     | Hourly sliding window         |
| 31  | OTP cooldown (60s) enforced in dev/prod | ✅     | Skipped in test env by design |
| 32  | 5 failed OTP attempts → 1h lockout      | ✅     | `otp:locked:{phone}`          |
| 33  | XSS in bio → sanitised, stored escaped  | ✅     | `<script>` → `&lt;script&gt;` |
| 34  | Audit log entries for login/logout      | ✅     | `audit_log` table populated   |
| 35  | Auth endpoints: IP rate limit 10/min    | ✅     | authEndpointLimit hook        |

---

## Web Client

| #   | Test                                          | Status | Notes                       |
| --- | --------------------------------------------- | ------ | --------------------------- |
| 36  | Welcome screen renders with logo and CTAs     | ✅     |                             |
| 37  | Register flow: name + phone → OTP → dashboard | ✅     |                             |
| 38  | Login flow: phone → OTP → dashboard           | ✅     |                             |
| 39  | OTP input auto-advances between boxes         | ✅     |                             |
| 40  | OTP shake animation on wrong code             | ✅     |                             |
| 41  | OTP resend timer works                        | ✅     | 30-second countdown         |
| 42  | Dev OTP banner (shows in development only)    | ✅     | Hidden in prod build        |
| 43  | Profile page shows all fields                 | ✅     | name, bio, location, stats  |
| 44  | Profile completeness score displays           | ✅     |                             |
| 45  | Edit profile modal opens/closes smoothly      | ✅     |                             |
| 46  | Avatar upload: file picker → S3 → saved       | ✅     | Progress ring shown         |
| 47  | Location autocomplete works                   | ✅     |                             |
| 48  | "Use current location" (browser GPS)          | ✅     |                             |
| 49  | Unsaved changes warning on cancel             | ✅     |                             |
| 50  | Settings page renders all sections            | ✅     |                             |
| 51  | Logout clears state → login page              | ✅     |                             |
| 52  | Mobile viewport (iPhone SE) layout            | ✅     | Responsive                  |
| 53  | Desktop layout                                | ✅     | Max-width 640px, centered   |
| 54  | Toast notifications show + auto-dismiss       | ✅     | 3s timeout                  |
| 55  | 401 auto-refresh transparent retry            | ✅     | Deduped with refreshPromise |

---

## Mobile App

| #   | Test                                       | Status | Notes                        |
| --- | ------------------------------------------ | ------ | ---------------------------- |
| 56  | Splash screen with pulsing logo            | ✅     |                              |
| 57  | Welcome screen animations                  | ✅     |                              |
| 58  | Register flow on mobile                    | ✅     |                              |
| 59  | Login flow on mobile                       | ✅     |                              |
| 60  | OTP auto-focus and auto-advance            | ✅     |                              |
| 61  | OTP clipboard detection on Android         | ✅     |                              |
| 62  | Keyboard avoiding view (inputs not hidden) | ✅     | Platform-adaptive            |
| 63  | Profile tab shows user profile             | ✅     |                              |
| 64  | Avatar tap → action sheet                  | ✅     | Camera/Gallery/Remove/Cancel |
| 65  | Camera permission flow                     | ✅     | Graceful denial handling     |
| 66  | Gallery permission flow                    | ✅     |                              |
| 67  | Image upload progress                      | ✅     | API proxy route              |
| 68  | Uploaded avatar renders on device          | ✅     | Via /api/v1/media proxy      |
| 69  | Location permission flow                   | ✅     |                              |
| 70  | Current location auto-fill                 | ✅     |                              |
| 71  | Location search autocomplete               | ✅     |                              |
| 72  | Edit profile saves correctly               | ✅     | district/state fields fixed  |
| 73  | Settings screen renders                    | ✅     |                              |
| 74  | Logout works                               | ✅     |                              |
| 75  | Hardware back button (Android)             | ✅     | Unsaved guard on EditProfile |
| 76  | Bottom tab navigation                      | ✅     |                              |
| 77  | App handles permission denial gracefully   | ✅     |                              |

---

## Bug Log

### Fixed during Day 15

| ID     | Description                                                                                   | Severity | Status                                     |
| ------ | --------------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
| BUG-01 | `activity.slice is not a function` — API returns `{ data: [] }` not `[]`                      | P0       | ✅ Fixed                                   |
| BUG-02 | Mobile avatar upload stuck at 20% — `fetch().blob()` fails for `file://` URIs                 | P0       | ✅ Fixed (proxy)                           |
| BUG-03 | iPhone upload hangs — port 4566 blocked by Windows Firewall                                   | P0       | ✅ Fixed (API proxy)                       |
| BUG-04 | Uploaded avatar not rendering on device — localhost:4566 unreachable                          | P0       | ✅ Fixed (media proxy)                     |
| BUG-05 | Location not shown on mobile ProfileScreen — wrong field names (`locationCity` vs `district`) | P1       | ✅ Fixed                                   |
| BUG-06 | Location save silently ignored — EditProfile sent wrong field names to API                    | P1       | ✅ Fixed                                   |
| BUG-07 | `completionSuggestions` → should be `profileSuggestions`                                      | P1       | ✅ Fixed                                   |
| BUG-08 | Activity icons all showing `•` — API returns `type` not `activityType`                        | P1       | ✅ Fixed                                   |
| BUG-09 | `otpCooldown` preHandler fired before CONFLICT check → second register gets 429 not 409       | P1       | ✅ Fixed (moved to service)                |
| BUG-10 | Sanitiser escaped `image/jpeg` → `image&#x2F;jpeg` — broke avatar-upload-url                  | P1       | ✅ Fixed (schema-based selective escaping) |
| BUG-11 | `generateRefreshToken` returns `{ token, family }` — old tests expected string                | P1       | ✅ Fixed (tests updated)                   |
| BUG-12 | Migration default `'{}'` invalid JSON for node-pg-migrate                                     | P1       | ✅ Fixed                                   |
| BUG-13 | `PutObjectCommandInput` TypeScript type imported as runtime value                             | P0       | ✅ Fixed                                   |
| BUG-14 | Cache-bust `?t=` saved to DB — broke `extractKeyFromUrl`                                      | P1       | ✅ Fixed                                   |

### Deferred to Sprint 2 (P2)

| ID    | Description                                                                  | Severity |
| ----- | ---------------------------------------------------------------------------- | -------- |
| P2-01 | Location "Use current location" shows city but not pincode on some addresses | P2       |
| P2-02 | Avatar upload doesn't crop/compress on web (large file sizes)                | P2       |
| P2-03 | Profile completeness dismissal not persisted across page reloads             | P2       |
| P2-04 | Settings page has no Aadhaar verification UI (stub only)                     | P2       |
| P2-05 | OTP dev banner flashes briefly during navigation on some browsers            | P2       |

---

## QA Sign-off

**Backend:** ✅ All P0/P1 tests passing  
**Web:** ✅ All critical flows working  
**Mobile:** ✅ All critical flows working  
**Tests:** ✅ 81/81 passing

**Sprint 1 QA: APPROVED** ✅
