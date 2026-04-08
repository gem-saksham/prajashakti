# PrajaShakti — प्रजाशक्ति

## What Is This Project?

PrajaShakti ("Power of the Citizens") is a civic engagement platform for India. It connects citizens in real time to collectively identify public issues, pressure government officials and bureaucrats, and demand accountability. The platform takes micro-donations (as low as ₹1/day) from citizens, uses a portion for operating costs to stay fully self-sufficient, and donates the rest to randomly selected 80G-certified non-profit organisations. All bank statements are public. No government, political, or corporate funding is accepted — ever.

**Sanskrit motto:** यत्र प्रजाशक्तिः तत्र सुशासनम् — "Where there is the power of citizens, there is good governance"

**Framework:** इच्छा (Desire) → ज्ञान (Knowledge) → क्रिया (Action)

## Tech Stack

- **Frontend:** React (Vite)
- **Styling:** Inline styles with CSS variables (no Tailwind, no CSS modules)
- **AI Integration:** Anthropic Claude API (`claude-sonnet-4-20250514`) via direct fetch to `https://api.anthropic.com/v1/messages`
- **Fonts:** Noto Sans (imported via Google Fonts)
- **No external UI libraries** — everything is custom-built

## Design System

### Color Palette

| Token          | Value              | Usage                                                |
| -------------- | ------------------ | ---------------------------------------------------- |
| Deep Teal      | `#0D4F4F`          | Primary brand, headings, header gradient start       |
| Teal           | `#14897A`          | Secondary brand, header gradient end, links, accents |
| Crimson Red    | `#DC143C`          | Logo, urgency, the inverted triangle brand mark      |
| Accent Orange  | `#E07B3A`          | Callouts, trending badges, debate highlights         |
| Text Primary   | `#1a1a1a`          | Main body text                                       |
| Text Secondary | `#555`             | Supporting text                                      |
| Text Muted     | `#888`             | Timestamps, metadata                                 |
| Card BG        | `#ffffff`          | Card backgrounds                                     |
| Page BG        | `#F4F5F0`          | Warm off-white page background                       |
| Border         | `rgba(0,0,0,0.08)` | Card and input borders                               |

### Typography

- Font: `'Noto Sans', 'Segoe UI', sans-serif`
- Headings: 700-800 weight
- Body: 13-14px, line-height 1.5
- Devanagari uses the same Noto Sans family

### Component Patterns

- **Cards:** `border-radius: 14-16px`, `1px solid var(--border)`, subtle hover shadow
- **Buttons (primary):** `background: linear-gradient(135deg, #0D4F4F, #14897A)`, white text, `border-radius: 10-12px`
- **Buttons (secondary):** Transparent bg, teal border, teal text
- **Badges/Pills:** `border-radius: 99px`, small padding, colored bg with matching text
- **Progress bars:** 6px height, rounded, gray track with colored fill
- **Inputs:** `border-radius: 10px`, `1px solid var(--border)`, teal focus ring with `box-shadow: 0 0 0 3px rgba(14,137,122,0.1)`
- **Modals:** Fixed overlay with `backdrop-filter: blur(4px)`, centered card with `border-radius: 20px`

### Layout

- Max width: `820px`, centered
- Padding: `16-20px`
- Card gap: `16px`
- Sticky header with gradient background
- Sticky tab navigation below header
- Bottom padding: `100px` for scroll clearance

## App Architecture

### Current Structure

The app is a single `App.jsx` file with these sections:

1. **Sample Data** — Arrays of issues, videos, debates, and officials at the top
2. **AI Helper** — `askAI()` function that calls Anthropic API
3. **Shared Components** — `ProgressBar`, `UrgencyBadge`, `StatPill`, `StarRating`
4. **Feature Components:**
   - `IssueCard` — Issue display with support button, stats, AI analysis trigger
   - `VideoCard` — Video thumbnail cards
   - `DebateCard` — Discussion threads with voting
   - `OfficialCard` — Bureaucrat/politician accountability profiles
5. **Modal Components:**
   - `CreateIssueModal` — New issue form with AI draft generation
   - `AIAnalysisPanel` — AI-powered issue analysis overlay
6. **Main App** — `PrajaShaktiApp` with tab navigation, search, filters

### Tab Structure

- **📢 Issues** — Browse, search, filter, support issues. Category filter pills. AI analysis per issue.
- **🎥 Videos** — Grid of citizen video evidence. Upload prompt.
- **⚖️ Debates** — Discussion threads. Agree/Disagree/Nuanced voting. AI debate summaries.
- **🏛️ Officials** — Accountability tracker. Star ratings, pending/resolved stats, response rates.

## Features To Build: Escalation System

This is the core pressure mechanism of PrajaShakti. Build this as a complete feature that integrates with the existing Issues tab. When a user clicks on an issue or selects "Escalate", they enter the escalation flow.

### Phase 1 — Accountability Page

Each bureaucrat/official gets a dedicated accountability page showing:

- Name, designation, office address, jurisdiction
- All issues filed against them with status
- Response timeline (how long they took or haven't responded)
- Citizen rating and public comments
- Photo/video evidence wall from all related issues
- Total number of affected citizens

### Phase 2 — Support Rally System

- Real-time supporter counter with animated progress bar
- Push notification concept (show as in-app notification bell)
- One-tap support button (already exists, enhance it)
- Auto-share to social media (generate share text with issue details)
- Milestone celebrations (100, 500, 1000, 5000, 10000 supporters)

### Phase 3 — RTI Auto-Generator (AI-powered)

- When user clicks "File RTI", Claude generates a legally formatted RTI application
- Pre-filled with: issue details, relevant department, specific questions to ask
- User can edit before "sending" (in prototype, show the generated document)
- Track RTI status on the issue page (Filed → Acknowledged → Response Due → Overdue)
- Batch RTI: allow multiple citizens to file similar RTIs simultaneously

### Phase 4 — Complaint & Escalation Letters (AI-powered)

- Auto-generate formal complaint letters to:
  - The bureaucrat's superior officer
  - District Collector / Commissioner
  - Relevant State Ministry
  - State Human Rights Commission
  - Lokayukta / Ombudsman
- Each letter is contextual, citing the issue, evidence, and number of affected citizens
- Show escalation as a visual ladder/timeline

### Phase 5 — Escalation Ladder (Auto-escalation)

Build a visual escalation timeline that shows:

```
Day 0: Issue reported → Bureaucrat notified
Day 3: First reminder sent
Day 7: Auto-escalate to Superior Officer
Day 14: Auto-escalate to District Collector
Day 21: Auto-escalate to State Commissioner + Media package triggered
Day 30: Auto-escalate to relevant Ministry + Legal aid options shown
```

- Show this as an interactive timeline on each issue
- Color-code: green (responded), amber (pending), red (overdue)
- Auto-progress based on elapsed time (simulate with sample data)

### Phase 6 — Video Evidence Wall

- Grid/masonry layout of all citizen videos for an issue
- Each video shows: thumbnail, citizen name, date, location, view count
- "Record & Upload" button prominently placed
- Counter: "47 citizens have documented this issue"
- AI-powered summary of all video evidence (what patterns emerge)

### Phase 7 — Social Media Campaign Generator (AI-powered)

- Generate ready-to-post content for Twitter/X, Instagram, Facebook
- Include hashtags, tag relevant department handles
- Create a campaign hashtag (e.g., #FixSector14Roads)
- Show viral metrics: impressions estimate, shares target
- "Campaign Kit" with pre-drafted posts citizens can copy-paste

### Phase 8 — Offline Mobilization Organizer

- Event creation: protest, vigil, fast (Upavas/Anushthaan), public meeting
- Location picker, date/time, expected attendance
- RSVP counter
- Auto-generate legal permission application for protests
- Safety guidelines and dos/don'ts
- Live attendance tracker during event

### Phase 9 — Media Package Trigger

When issue crosses threshold (e.g., 10,000 supporters or 100 videos):

- Auto-compile a "Media Package" with:
  - Issue summary (AI-generated press note)
  - Timeline of bureaucratic inaction
  - Key statistics (affected citizens, pending days, escalations sent)
  - Top 5 most impactful citizen videos
  - Official's accountability scorecard
- One-click "Send to Media" (show as ready-to-send package)
- Track media coverage (manual entry in prototype)

### Phase 10 — Permanent Scorecard

- Every official's record persists permanently
- Show trend: improving / declining / stagnant
- Compare officials in same region
- Election season mode: surface scorecards when elections are near

## AI Integration Pattern

All AI features use the same pattern:

```javascript
async function askAI(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.map((b) => b.text || '').join('\n') || 'Unable to generate response.';
}
```

For new AI features (RTI generator, complaint letters, social media campaigns, media packages), use the same function with well-crafted prompts that include:

- The system context ("You are an assistant for PrajaShakti, an Indian civic engagement platform")
- All relevant issue data (title, location, description, official details, supporter count)
- Specific output format instructions
- "Write in English" and "Keep it factual and actionable"

## File Organization (Target)

When splitting into multiple files, use this structure:

```
src/
  App.jsx                    — Main app shell, routing, state
  components/
    Header.jsx               — App header with stats
    Navigation.jsx           — Tab bar
    issues/
      IssueCard.jsx          — Issue display card
      IssueList.jsx          — Filtered list of issues
      CreateIssueModal.jsx   — New issue form
      EscalationTimeline.jsx — Visual escalation ladder
      RTIGenerator.jsx       — AI-powered RTI filing
      EscalationLetters.jsx  — AI complaint letter generator
      VideoEvidenceWall.jsx  — Grid of citizen videos
      MediaPackage.jsx       — Auto-compiled media kit
    videos/
      VideoCard.jsx          — Video thumbnail card
      VideoFeed.jsx          — Video grid with upload
    debates/
      DebateCard.jsx         — Discussion thread
      DebateList.jsx         — Debate feed with AI summaries
    officials/
      OfficialCard.jsx       — Accountability profile
      OfficialPage.jsx       — Full accountability page
      Scorecard.jsx          — Permanent performance record
    campaigns/
      SocialMediaKit.jsx     — Campaign content generator
      OfflineMobilizer.jsx   — Event organizer
      SupportRally.jsx       — Real-time support counter
    shared/
      ProgressBar.jsx
      UrgencyBadge.jsx
      StarRating.jsx
      StatPill.jsx
      Modal.jsx
  utils/
    ai.js                    — askAI helper function
    data.js                  — Sample data
    constants.js             — Colors, categories, config
  styles/
    theme.js                 — CSS variable definitions
```

## Important Notes

- **No Tailwind** — all styling is inline or CSS variables
- **No external UI libraries** (no Material UI, Chakra, Ant Design)
- **Single-page app** — tab-based navigation, no React Router needed initially
- **Responsive** — works on both mobile (phone-first) and desktop
- **All content is in English** — app name and logo are in Devanagari
- **India-specific context** — RTI Act, 80G tax certificates, Lokayukta, Indian bureaucratic hierarchy
- **The logo is a crimson red (`#DC143C`) inverted triangle** with प्रजाशक्ति written inside
- **AI features gracefully degrade** — if API fails, show helpful error message, rest of app works fine
- **Keep the warm, earthy tone** — not corporate blue, not startup purple. Teal + crimson + off-white warmth.

---

## Sprint 1 Architecture (Implemented — Days 1–15)

Sprint 1 delivered the complete authentication and identity foundation. The monorepo has three apps:

### API (`apps/api/`) — Fastify + PostgreSQL + Redis

**Key patterns established:**

- **Service layer:** All business logic in `src/services/`, routes only handle HTTP. Throw `ServiceError(statusCode, code, message)` from services; routes catch and forward.
- **Parameterised queries only:** No ORM, no raw string interpolation. `pg.Pool` with `query(sql, [params])`.
- **Schema-based sanitisation:** `src/middleware/sanitiser.js` escapes only fields explicitly listed in `ROUTE_SCHEMAS` (bio, name, description, title, comment). Structured fields (MIME types, UUIDs, URLs) pass through unchanged — escaping them breaks validation.
- **OTP cooldown bypassed in tests:** `checkOtpCooldown()` returns early when `NODE_ENV=test`. This is intentional — tests register+verify+login in rapid succession.
- **Token family tracking:** `generateRefreshToken` returns `{ token, family }` — the family UUID groups all rotations from a single login session. Reuse of a rotated token → `revokeFamily()` → all sessions invalidated.
- **Media proxy:** Mobile cannot reach LocalStack (port 4566). Use `POST /me/avatar` (raw bytes → API → S3) for upload and `GET /api/v1/media/*` (API → S3 → device) for display.

**File map:**

```
apps/api/src/
  app.js                    ← Fastify factory (plugins, hooks, routes)
  server.js                 ← Entry point (security checks, listen)
  db/
    postgres.js             ← pg.Pool + health check
    redis.js                ← ioredis + health check
  middleware/
    auth.js                 ← authenticate, optionalAuth, requireRole
    sanitiser.js            ← Input sanitisation hook (preValidation)
    rateLimiter.js          ← OTP rate limit, auth endpoint limit, lockout
    logger.js               ← Pino config + redactSensitive()
    validator.js            ← phoneSchema, otpSchema, uuidSchema
    errorHandler.js         ← Global error handler
    requestId.js            ← X-Request-ID header
    versioning.js           ← /api/v1 prefix + sub-route registration
  models/
    user.js                 ← All DB queries for users table
    userActivity.js         ← Activity log reads/writes
  routes/
    users.js                ← Auth + profile routes
    location.js             ← Geocoding routes
    media.js                ← S3 media proxy
    status.js               ← Rich health check
    health.js               ← Simple liveness probe
  services/
    userService.js          ← Registration, login, OTP verify, profile CRUD
    tokenService.js         ← JWT access tokens + Redis refresh tokens
    uploadService.js        ← S3 pre-signed URLs + direct upload
    locationService.js      ← Nominatim + ip-api.com
    auditService.js         ← Audit log writes (fire-and-forget)
    otpProvider.js          ← SMS gateway (console.log in dev)
    aadhaarService.js       ← Stub (Sprint 3)
    googleAuth.js           ← Google token verification
  utils/
    transform.js            ← camelCase ↔ snake_case
    securityCheck.js        ← Startup security validation
  migrations/               ← node-pg-migrate .cjs files
```

### Web (`apps/web/src/`)

- `utils/api.js` — central API client with 401 refresh interceptor and `refreshPromise` dedup
- `utils/sanitize.js` — `safeUrl()` blocks `javascript:` / `data:` URIs; `multilineTextStyle` for safe pre-wrap
- Context: `AuthContext` holds user + tokens; `ToastContext` for notifications
- All styling: inline styles + CSS variables (no Tailwind, no UI libraries)

### Mobile (`apps/mobile/src/`)

- `utils/api.js` — same refresh interceptor pattern, uses AsyncStorage
- `context/AuthContext.jsx` — auth state + token storage
- `hooks/useDevHost.js` — detects LAN IP for Expo dev (needed for media proxy URLs)
- `components/Avatar.jsx` — `resolveUri()` rewrites LocalStack URLs to go through the media proxy
- Profile field names: API uses `district`, `state`, `pincode` (DB column names) — NOT `locationCity`/`locationState`/`locationPincode`

### Test Conventions

- Tests are in `apps/api/tests/` — `unit/`, `integration/`, `security/`, `services/`
- `tests/helpers.js` — `createTestApp()`, `truncateTables()`, `createTestUser()`, `testRedis`
- All integration tests hit a real test DB + Redis (`NODE_ENV=test`)
- `generateRefreshToken` returns `{ token, family }` — always destructure, never treat as string
- `verifyRefreshToken` returns `{ userId, family, createdAt, device }` — access `.userId`, not the string directly

### Known Gotchas

- **node-pg-migrate default syntax:** Use `pgm.func("'{}'::jsonb")` not `"'{}'"` for JSONB defaults
- **fast-jwt:** Does not accept negative `expiresIn` — embed `exp` directly in payload for expired token tests
- **jsdom + Jest ESM:** Use dynamic `import()` for jsdom; provide `NODE_ENV=test` fallback in sanitiser
- **Windows + Expo + LocalStack:** Port 4566 blocked by default firewall; use the media proxy pattern
