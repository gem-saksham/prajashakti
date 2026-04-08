# Sprint 1 Demo Script

**Sprint 1 — Authentication & Identity Foundation**  
**Date:** 2026-04-08  
**Duration:** ~20 minutes  
**Audience:** Stakeholders / contributors

---

## Setup Before Demo

```bash
# Start the full stack
docker compose up -d

# Confirm everything is healthy
curl http://localhost:3000/api/v1/status
# Expected: { "status": "ok", "services": { "postgres": ..., "redis": ... } }

# Open web app
open http://localhost:5173

# (Have Expo Go open on a physical device or emulator)
```

---

## Act 1 — The Status Check (1 minute)

Open `http://localhost:3000/api/v1/status` in a browser.

**Talking points:**

- We can see Postgres latency (~2ms on local), Redis latency (~1ms)
- Memory usage shown — useful for identifying leaks in production
- `uptime` tells us when the process last restarted
- This endpoint is what the load balancer will poll in production

---

## Act 2 — Web Registration Flow (4 minutes)

Open `http://localhost:5173`.

**Step 1 — Welcome screen**

- Show the logo, tagline, the two CTAs (Register / Login)
- Note the Devanagari brand name and Sanskrit motto

**Step 2 — Register**

- Click "Get Started" → enter name "Demo User", phone "9100000099"
- Submit → OTP screen appears
- Point out the yellow dev banner showing the OTP (only in development)
- Enter the OTP → auto-advances between boxes, shake animation on wrong digit

**Step 3 — Dashboard / Profile**

- Shows profile completeness score (30% — phone is there, nothing else)
- Suggestions: "Add a profile photo", "Write a short bio", etc.
- Click "Edit Profile" → fill in bio, district, state, pincode
- Submit → completeness jumps to 75%

**Step 4 — Avatar upload**

- Click avatar → file picker → select any image
- Progress ring animates while uploading
- Avatar appears after upload

**Step 5 — Settings → Logout**

- Click logout → tokens cleared → redirected to login

---

## Act 3 — Web Login + Token Refresh (2 minutes)

**Step 1 — Login**

- Enter phone "9100000099" → OTP → same dashboard appears
- Point out: "This is the same account we registered 2 minutes ago"

**Step 2 — Token lifecycle (explain)**

- Access token: 15-minute window, lives in memory
- Refresh token: 30 days, rotated on each use
- If access token expires mid-session, the client silently refreshes and retries the original request — user never sees a login prompt

---

## Act 4 — Mobile App (5 minutes)

Open Expo Go on device or emulator.

**Step 1 — Splash screen**

- Pulsing logo on launch

**Step 2 — Register on mobile**

- Register with a different phone number (e.g. 9100000088)
- Show OTP input: clipboard detection on Android auto-pastes the OTP

**Step 3 — Mobile profile**

- Same fields as web — profile completeness, suggestions
- Tap avatar → action sheet: Camera / Gallery / Remove / Cancel
- Camera permission flow — graceful denial handling

**Step 4 — Location**

- Edit Profile → "Use current location" button
- Fills district/state from GPS
- Or type a city in the search box → autocomplete

**Step 5 — Mobile avatar upload**

- Select image from gallery
- Uploads via the API proxy (mobile → API → S3)
- Image renders via the media proxy (no direct S3 access needed)

---

## Act 5 — Security Features (4 minutes)

Switch to terminal.

**OTP rate limiting:**

```bash
# Try to register the same number 6 times
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/api/v1/users/register \
    -H 'Content-Type: application/json' \
    -d '{"phone":"9100000077","name":"Test"}' | jq '.error.code'
done
# First 5: null (success), 6th: "RATE_LIMITED"
```

**OTP lockout:**

```bash
# Register a new number
curl -s -X POST http://localhost:3000/api/v1/users/register \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9100000066","name":"Lock Test"}'

# Submit wrong OTP 3 times
for i in {1..3}; do
  curl -s -X POST http://localhost:3000/api/v1/users/verify-otp \
    -H 'Content-Type: application/json' \
    -d '{"phone":"9100000066","otp":"000000"}' | jq '.error.code'
done
# 1st: "VALIDATION_ERROR", 2nd: "VALIDATION_ERROR", 3rd: "RATE_LIMITED"
```

**XSS sanitisation:**

```bash
# Login as demo user, get token, try XSS in bio
TOKEN="eyJ..."
curl -s -X PATCH http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"bio":"<script>alert(1)</script>Activist"}' | jq '.user.bio'
# Output: "&lt;script&gt;alert(1)&lt;/script&gt;Activist"
```

---

## Act 6 — Swagger UI (1 minute)

Open `http://localhost:3000/api/docs`.

**Talking points:**

- All 18 endpoints documented with request/response schemas
- Click any endpoint → "Try it out" → live testing from the browser
- Only available in development — not exposed in production build

---

## Act 7 — Test Suite (1 minute)

```bash
cd apps/api && npm test 2>&1 | tail -20
```

Show: **81 tests, 0 failures**

**Talking points:**

- Unit tests for token service (access token, refresh token, blacklist)
- Integration tests for all auth flows (register, login, verify, refresh, logout)
- Security tests: rate limiting, lockout, XSS, CORS, token reuse detection
- Profile tests: avatar upload, field updates, public profile

---

## Q&A Prompts

**"How does the OTP system work in production?"**

> The OTP provider is a pluggable interface. In dev it logs to console. In production we'll swap it to an SMS gateway (e.g. MSG91 or Twilio). The phone validation already enforces Indian mobile numbers (10 digits, starting 6–9).

**"What happens if someone steals a refresh token?"**

> If an attacker uses a stolen refresh token after the victim has already rotated it, we detect the reuse — the old token is already gone. This triggers family revocation: every token from that login session is invalidated and the user is forced to log in again on all devices.

**"Is this GDPR / DPDP compliant?"**

> Sprint 1 is foundational. We store only the minimum PII needed (phone number, optional name/bio/location). Phone numbers are hashed in logs. The DPDP Act (India's data protection law) will require a deletion flow — that's planned for Sprint 2.

---

## Demo Wrap-up

"Sprint 1 gave us a complete, production-ready authentication foundation: OTP auth, token rotation with reuse detection, profile management, avatar upload, and location services — all with a full test suite and security hardening. Sprint 2 starts tomorrow with the Issues feature — the core content type that everything else builds on."
