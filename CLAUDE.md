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

---

## Sprint 2 Day 16 — Issue Data Model (CPGRAMS Taxonomy Foundation)

### Database Schema

Four new tables added in Sprint 2 Day 16:

| Table                  | Purpose                                                    | Rows (seeded) |
| ---------------------- | ---------------------------------------------------------- | ------------- |
| `ministries`           | Top-level government hierarchy: Central + State + UT       | ~97           |
| `departments`          | Service delivery units under each ministry                 | ~167          |
| `grievance_categories` | Maps citizen issues to CPGRAMS routing codes               | ~75           |
| `issues`               | Core citizen issue entity (recreated with enhanced schema) | 0             |

### Key Patterns

- **Government taxonomy:** `ministries → departments → grievance_categories`. All nullable FKs on the issues table — populated by user selection (Sprint 2) or NLP classification (Phase 2 Sprint 9).
- **Tracking IDs JSONB:** `issues.tracking_ids` stores external references (CPGRAMS, state portals, RTI, NCH). Indexed with GIN for `@>` containment queries.
- **Photos as JSONB:** `issues.photos` is `JSONB DEFAULT '[]'` (changed from TEXT[] in Sprint 1). Each entry is `{url, caption, uploadedAt}`.
- **Enhanced statuses:** `active → trending → escalated → officially_resolved / citizen_verified_resolved / citizen_disputed → closed`. The Sprint 1 `responded` and `resolved` statuses are replaced.
- **Seed script:** `npm run seed:taxonomy` in `apps/api`. Idempotent (ON CONFLICT DO UPDATE).

### Models Added

- `src/models/issue.js` — Full CRUD, geo queries (Haversine), JSONB tracking ID ops, atomic counter increments
- `src/models/government.js` — Ministry/department/category CRUD, ILIKE search, keyword matching

### File Map Update

```
apps/api/
  migrations/
    20260409000011_create-ministries.cjs
    20260409000012_create-departments.cjs
    20260409000013_create-grievance-categories.cjs
    20260409000014_recreate-issues-with-taxonomy.cjs
  seeds/
    ministries.json
    departments.json
    grievance-categories.json
  scripts/
    seed-taxonomy.js
  src/
    models/
      issue.js
      government.js
    types/
      issue.js          ← JSDoc type definitions for Issue entity
    middleware/
      validator.js      ← Enhanced with taxonomy schemas, tracking IDs, geo queries
```

## Phase 2 Preparation (Built in Sprint 2)

The issue schema and taxonomy are designed to support Phase 2 government
integration with zero schema changes. Key bridge points:

- `issues.ministry_id`, `department_id`, `grievance_category_id` — populated
  by user in Sprint 2 (dropdown selection) or by NLP in Phase 2 Sprint 9
- `issues.tracking_ids` JSONB — user-populated after filing on CPGRAMS,
  polled by Phase 2 Sprint 8 status sync
- `issues.discrepancy_score` — populated by Phase 2 Sprint 11 Reality Check
- `ministries`, `departments`, `grievance_categories` — seeded from public
  sources, expanded over time

When Phase 2 Sprint 7 begins, the data ingestion pipelines will ADD to
these tables (e.g., from OGD CPGRAMS datasets), not replace them.

---

## Sprint 2 Days 17–22 — Issue Engine (Complete)

### Days 17–18: Issue CRUD + Photo Pipeline

- Full issue CRUD API (create, read, update, soft-delete, list, stats, nearby, jurisdiction, bbox)
- Multi-photo upload pipeline with EXIF GPS verification (S3 + presigned URLs)
- 30 route tests, 26 integration flow tests

### Days 19–21: Officials, Supports, Anti-Gaming

- Officials model + routes (CRUD, jurisdiction search, tagging to issues)
- Support system with weighted votes (unverified 0.5×, verified 1.0×, leader 1.2×, admin 1.3×)
- Anti-gaming service: velocity spike detection, IP concentration, UA concentration
- `suspicious_activity` table for moderation queue (Phase 2 Sprint 6)
- Tag suggestion service: CPGRAMS keyword → ministry/department matching

### Day 22: Security + Docs + Realistic Seed

- **Security regression (63 tests):** IDOR, SQLi, XSS, mass assignment, tracking ID injection, UUID fuzzing, geo bounds, oversized payloads
- **Docs:** `apps/api/docs/` — PERFORMANCE_BUDGET.md, REDIS_KEYS.md, SLOW_QUERIES.md, PHASE_2_BRIDGES.md, DATA_MODEL.md (Mermaid ER)
- **Realistic seed:** 200 users, 500 issues, ~6,000 supports — `npm run seed:realistic`
- **Coverage:** 470 tests, services at 80% statement coverage

### Key Patterns (Sprint 2)

- `logActivity(userId, action, entityType, entityId, metadata)` — **5-arg signature**. Never pass metadata as the third arg; that writes a 200-char JSON string into `entity_type VARCHAR(30)`.
- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block — node-pg-migrate wraps every migration in BEGIN/COMMIT. Use plain `CREATE INDEX IF NOT EXISTS` in migration files; apply CONCURRENTLY manually in production.
- Fastify `removeAdditional: 'all'` strips unknown body fields silently (no 400) — security tests verify the field is absent in DB, not that a 400 was returned.
- Sanitiser runs `preValidation` — `validator.escape()` truncates fields to `maxLength` before Fastify schema validation runs, so oversized inputs return 201 (truncated) not 400.

---

## Sprint 3 Day 23 — Ranked Feed API

### New endpoint: `GET /api/v1/feed`

**Feed modes** (query param `mode`):
| Mode | Behaviour |
|------|-----------|
| `trending` (default) | Composite score: engagement + urgency + recency + location trust |
| `latest` | Newest first, score still computed |
| `critical` | Only urgency ∈ {critical, high}, sorted by score |
| `nearby` | Geo-filtered (requires `lat`/`lng`), sorted by score; includes `distanceKm` |

**Scoring formula (SQL, in `FEED_SCORE_EXPR`):**

```
LN(1 + supporter_count) × 0.4   — engagement
LN(1 + view_count)      × 0.1   — views
urgency_boost           × 0.3   — critical=4, high=3, medium=2, low=1
is_verified_location    × 0.1   — EXIF-verified trust signal
recency_decay           × 0.1   — 1/(1 + days_old × 0.1)
```

**Optional filters:** `category`, `urgency`, `state`, `district`, `is_campaign`
**Pagination:** `page`, `limit` (max 50)
**Cache:** Redis, per-mode TTL — trending 30 s, nearby 45 s, latest/critical 60 s

**Response shape:**

```json
{
  "success": true,
  "data": [{ ...issue, "feedScore": 2.341, "distanceKm": 1.234 }],
  "pagination": { "page": 1, "limit": 20, "total": 500, "totalPages": 25 },
  "meta": { "mode": "nearby", "lat": 28.61, "lng": 77.20, "radiusKm": 20 }
}
```

### Files added (Day 23)

```
apps/api/src/
  models/issue.js         ← findFeed() — SQL scoring formula, all 4 modes
  services/feedService.js ← getFeed(), invalidateFeedCache() (SCAN+DEL pattern)
  routes/feed.js          ← GET /api/v1/feed (optionalAuth)
  utils/cacheKey.js       ← feedCacheKey(), FEED_TTL constants
  middleware/validator.js ← feedQuerySchema
  middleware/versioning.js← registered under /feed prefix
tests/routes/feed.test.js  — 30 integration tests (all modes, filters, pagination, cache, auth)
```

### Test count

**470 total** (440 pre-Day-23 + 30 feed tests)

---

## Sprint 2 Days 24–30 — Web UI, Mobile UX, Review (Complete)

### Days 24–26: Web Issue Surface

- 4-step issue creation wizard with draft autosave to localStorage
- Issue list with URL-synced filter chips + infinite scroll
- Issue detail page with photo lightbox, map, timeline, quick-support
- Shared filter URLs (`/issues?category=infrastructure&state=DL`) rehydrate correctly

### Day 27: Mobile Photo-First Creation

- Capture-first flow: camera/gallery → location → category → review
- EXIF GPS preserved through Expo ImageManipulator
- Offline draft queue (AsyncStorage) with NetInfo-based auto-drain

### Day 28: Mobile Native UX Enhancements

- Swipe actions on `SwipeableIssueCard` — right=Support (teal), left=Share (orange)
- Pinch-to-zoom photo gallery with GPS overlay + long-press save-to-device
- Deep linking: `prajashakti://issues/:id` + `https://prajashakti.in/issues/:id`
- Offline issue cache (50 issues, 24h TTL) + queued support actions (collapse by last-write)
- Haptics: Medium on support, Success on milestones [50,100,250,500,1000,2500,5000,10000], selection on refresh/category
- FlatList tuned: windowSize=5, maxToRenderPerBatch=10, removeClippedSubviews on Android
- `useNotificationDeepLink` hook: tap push notification → `globalThis.__navigateToIssue(issueId)`

### Day 30: Sprint 2 Review

- **Final test count:** 470 tests, 16 suites, all green
- **Coverage:** 67.16% statements (below 75% target — gaps in searchService/storyService/stub routes, documented in `docs/SPRINT_2_COVERAGE.md`)
- **Bug triage:** 0 P0, 0 P1 open (1 P1 caught+fixed mid-session — Animated.Value render error in SwipeableIssueCard), 8 P2 deferred to Sprint 3 backlog
- **Docs:** `docs/SPRINT_2_QA.md` (regression matrix), `docs/SPRINT_2_COVERAGE.md`, `docs/retrospectives/SPRINT_2.md`, `docs/SPRINT_3_KICKOFF.md`, `docs/API.md` (44 endpoints documented), `apps/api/docs/PHASE_2_BRIDGES.md` (9 bridges)
- **Sprint 3 backlog (P2):** SRCH-001, STOR-001, PHOT-001, GOV-001, RATE-001, PERF-001, pg_stat_statements, ai.js route

### Key Patterns (Days 24–30)

- Mobile `<Animated.View>` required when consuming `Animated.Value` on transform prop — passing to plain `<View>` throws `ATransform with key of 'scale' must be number`.
- Swipeable `dragX.interpolate(...)` returns an Animated.Value; wrap the scaling children in `Animated.View`, not `View`.
- Offline support queue: `Map`-based collapse per issueId (last-write-wins) prevents unbounded queue growth when a user rapidly toggles support while offline.
- React Navigation `linking` config with nested `FeedTab.IssueDetail: 'issues/:id'` handles both `prajashakti://` and `https://prajashakti.in` prefixes; the notification deep-link path uses `globalThis.__navigateToIssue` exposed by `RootNavigator`.
- AsyncStorage cache keys: `prajashakti_issue_list_cache` (page 1 only, 24h TTL), `prajashakti_issue_detail_{id}`, `prajashakti_support_queue`.

---

## Sprint 2 Days 28–30 — Mobile Native UX + Sprint Review (Complete 2026-04-21)

### Day 28 — Mobile native enhancements

- Pull-to-refresh haptic feedback (`Haptics.selectionAsync()` on feed + category change)
- Swipe actions on IssueCard — right=Support (teal + Medium impact), left=Share (orange)
  - `SwipeableIssueCard.jsx` wraps `IssueCard` in `Swipeable` from `react-native-gesture-handler`
  - **Gotcha:** `dragX.interpolate(...)` returns `Animated.Value` — consumer MUST be `<Animated.View>`, not `<View>`, or RN throws `ATransform with key of 'scale' must be number`
- Native share sheet via `Share.share()` with `prajashakti://issues/:id` deep link + `https://prajashakti.in/issues/:id` web fallback
- Photo gallery: pinch-zoom (iOS via `ScrollView maximumZoomScale`, cross-platform double-tap 2×), GPS badge overlay, long-press save-to-device via `expo-sharing`
- Deep linking: `app.json` scheme + React Navigation `linking` config with nested screens (`FeedTab.IssueDetail: 'issues/:id'`)
- FlatList tuning: `windowSize=5`, `maxToRenderPerBatch=10`, `removeClippedSubviews={Platform.OS === 'android'}`, memoized `renderItem`/`keyExtractor`
- Offline mode:
  - `services/issueCache.js` — AsyncStorage cache of page-1 feed + per-issue detail, 24h TTL
  - `services/supportQueue.js` — offline queue, collapse last-wins per issueId, drain on reconnect
  - `hooks/useNetworkState.js` — NetInfo subscription (starts optimistic to avoid false offline flash)
  - `components/OfflineBanner.jsx` — crimson banner shown when offline
  - `hooks/useSupportedIds.js` — enqueues on offline toggle, subscribes to drain on mount
- Notification tap navigation — `hooks/useNotificationDeepLink.js` lazy-requires `expo-notifications` inside try/catch and calls `globalThis.__navigateToIssue(issueId)` exposed by `RootNavigator`

### Day 30 — Sprint 2 review (QA, bugs, docs)

- Full QA regression matrix — `docs/SPRINT_2_QA.md` (0 P0, 0 P1 open, 8 P2 deferred)
- Coverage report — `docs/SPRINT_2_COVERAGE.md` (67.16% stmts overall; `searchService` 6% and `storyService` 5% pull average down)
- Retrospective — `docs/retrospectives/SPRINT_2.md`
- Sprint 3 kickoff — `docs/SPRINT_3_KICKOFF.md`
- API docs updated — `docs/API.md` — all 27 Sprint 2 endpoints with curl + response examples
- Phase 2 bridges doc updated — Section 9 (Feed Bridge) marked DELIVERED

### Sprint 2 final numbers

- **470 tests, 16 suites, all green** (143s runtime)
- **44 endpoints** total (17 Sprint 1 + 27 Sprint 2)
- **18 DB tables, 22 migrations**
- **0 P0 / P1 bugs open**
- Realistic seed: 202 users, 503 issues, 6,013 supports, 97 ministries, 167 departments, 80 grievance categories

### Sprint 2 P2 backlog (carried to Sprint 3)

| Ticket   | Target                                                |
| -------- | ----------------------------------------------------- |
| SRCH-001 | searchService coverage 6% → 80%                       |
| STOR-001 | storyService + stories route coverage → 60%           |
| PHOT-001 | photos route coverage 19% → 75%                       |
| GOV-001  | government route coverage 14% → 75%                   |
| RATE-001 | rateLimiter coverage 16% → 70% (NODE_ENV override)    |
| PERF-001 | Artillery nightly job + P95 dashboard                 |
| (chore)  | Enable pg_stat_statements in dev compose              |
| (chore)  | ai.js route 4% — intentional (external Anthropic API) |
