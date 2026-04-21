# Phase 2 Hook Points — PrajaShakti Issue Engine

This document lists every integration point that Phase 2 Sprint 7 will read on Day 1.
Each section names the DB column/table, the current data source, and what Phase 2 will write to it.

---

## 1. CPGRAMS Taxonomy Bridge

### Schema

```
ministries (id, code, name, type, state_code, cpgrams_code)
    └── departments (id, code, name, ministry_id, cpgrams_code)
            └── grievance_categories (id, slug, praja_category, cpgrams_category_code,
                                      default_department_id, keywords[])
issues.ministry_id           → FK → ministries.id
issues.department_id         → FK → departments.id
issues.grievance_category_id → FK → grievance_categories.id
```

### Current data source

User selection during issue creation (dropdown), OR keyword-based tag suggestion (`tagSuggestionService.autoSuggest`). Both paths are nullable.

### Phase 2 Sprint 9 write-in

NLP classifier (fine-tuned BERT on CPGRAMS dataset) will:

1. Accept issue `title` + `description`
2. Return `{ ministry_id, department_id, grievance_category_id, confidence }`
3. Write to `issues` via `UPDATE issues SET ... WHERE id = $1 AND grievance_category_id IS NULL` (only fills in if user didn't select)
4. The `tagSuggestionService.suggestGrievanceCategory()` interface is kept intact — Sprint 9 replaces the SQL keyword match with an API call to the NLP service.

### Phase 2 Sprint 7 data ingestion

`ministries`, `departments`, `grievance_categories` will be expanded with official OGD CPGRAMS datasets. Use `ON CONFLICT (code) DO UPDATE` — same idempotent pattern as `seed-taxonomy.js`.

---

## 2. External Tracking IDs (CPGRAMS / State Portals / RTI)

### Schema

```sql
issues.tracking_ids  JSONB  DEFAULT '{}'
-- GIN index: idx_issues_tracking_ids
-- Example value:
{
  "cpgrams": "CPGR/2026/INFRA/123456",
  "rti":     "RTI/2026/MHA/7890",
  "state":   "DL-PWD-2026-0042",
  "nch":     "NCH-2026-789"
}
```

### Current data source

User-entered via `PATCH /issues/:id` (Phase 1). Validated as a flat key→string JSON object in `validator.js`.

### Phase 2 Sprint 8 write-in

Status sync workers will:

1. Poll CPGRAMS portal for `tracking_ids.cpgrams` entries
2. Write back `issues.status` updates: `active → escalated → officially_resolved`
3. Use `IssueModel.updateTrackingId(issueId, 'cpgrams', value)` for atomic JSONB updates
4. Query pattern for batch sync: `SELECT id, tracking_ids FROM issues WHERE tracking_ids @> '{"cpgrams": ""}' LIMIT 100`

---

## 3. Support Weight System

### Schema

```sql
supports.weight  DECIMAL(3,2)  -- populated at INSERT time
```

### Current implementation

`computeSupportWeight(user)` in `src/utils/supportWeight.js`:

- Unverified: 0.5 base, capped by account age
- Verified: 1.0 base
- Leader role: 1.2 min
- Moderator/Admin: 1.3 min
- Reputation bonus: +0.3 max (at 10,000 reputation)
- Age penalties: <24h → 0.3 cap, <7d → 0.7 cap

### Phase 2 Sprint 6 enhancement

Aadhaar verification (Sprint 3 intent) will change `is_verified = true` for Aadhaar-linked accounts. No schema change needed — the weight formula already uses `is_verified`.

Phase 2 Sprint 11 (discrepancy scoring) will add a `discrepancy_modifier` to the weight formula if an issue's `discrepancy_score > 0.7` (indicating manipulated supports).

---

## 4. Milestone Events → Notification Pipeline

### Current implementation

`eventBus.emit('issue.milestone.reached', { issueId, milestone, crossedAt })` fires after every milestone (10, 50, 100, 500, 1000, 5000, 10000, 50000 supporters).

`eventBus.emit('issue.trending', { issueId })` fires when milestone >= 100 (also auto-updates `issues.status = 'trending'`).

### Current event bus

`src/services/eventBus.js` — `EventEmitter` scaffold. Events are advisory; no subscriber registered in Phase 1.

### Phase 2 Sprint 5 write-in

Replace `EventEmitter` with Kafka producer. The `emit(name, payload)` call signature stays identical. Phase 2 Sprint 5 will:

1. Import `createKafkaProducer()` from a new `kafkaService.js`
2. Replace `eventBus.emit(...)` with `kafkaProducer.send({ topic: name, messages: [{ value: JSON.stringify(payload) }] })`
3. Subscribe to `issue.milestone.reached` → push notification to `notifications` table → mobile push via FCM

### Notification table (already in schema)

```sql
notifications (id, user_id, type, payload JSONB, read_at, created_at)
```

Currently empty. Sprint 5 notification writer will INSERT here on milestone events.

---

## 5. Official Accountability Score

### Schema

```sql
officials.total_issues_tagged     INT  DEFAULT 0
officials.total_issues_resolved   INT  DEFAULT 0
officials.avg_resolution_days     DECIMAL(6,2)
officials.citizen_satisfaction_score  DECIMAL(3,2)
officials.discrepancy_score       DECIMAL(3,2)
```

### Current data source

`total_issues_tagged` is incremented on issue-official tagging via `OfficialModel.incrementTaggedCount()`. All other columns default to 0.

### Phase 2 Sprint 10 write-in

Permanent scorecard computation will:

1. Query `issue_officials` JOIN `issues` for all issues tagged to each official
2. Count resolved vs unresolved
3. Compute `avg_resolution_days` from `issues.resolved_at - issues.created_at`
4. Run weekly batch UPDATE via a cron job
5. `citizen_satisfaction_score` will come from comment sentiment analysis (Sprint 11)

---

## 6. Photo EXIF → Location Verification

### Schema

```sql
issues.is_verified_location  BOOLEAN  DEFAULT false
issues.photos                JSONB    DEFAULT '[]'
-- photo entry shape: { url, caption, uploadedAt, isVerifiedLocation, distanceMeters }
```

### Current implementation

`exifService.verifyLocation(exif, { lat, lng }, 500)` returns `{ verified, distanceMeters }`. Used in `photoUploadService.confirmUpload()`.

`is_verified_location` is set to `true` on the issue when any photo is verified within 500m.

### Phase 2 Sprint 4 enhancement

Video uploads will add an `exif.timestamp` check:

- Photo timestamp must be within ±7 days of issue `created_at`
- If outside window: `isVerifiedLocation = false`, flag with reason `TIMESTAMP_MISMATCH`

The `photoEntry` shape in the JSONB will gain `{ ..., exifTimestamp, verificationReason }`.

---

## 7. Issue Status Machine

### Current statuses

```
active → trending (at 100 supporters, auto)
       → escalated (manual or at 1000 supporters, Phase 2)
       → officially_resolved (CPGRAMS status sync, Phase 2)
       → citizen_verified_resolved (citizen marks resolved)
       → citizen_disputed (citizen disputes official resolution)
       → closed (soft delete by creator or admin)
```

### Phase 2 Sprint 8 automatic transitions

The status sync worker will drive transitions:

- `active → escalated` when CPGRAMS status = "Under Process"
- `escalated → officially_resolved` when CPGRAMS status = "Disposed"
- `officially_resolved → citizen_disputed` when citizen disputes within 30 days

### API hook

`IssueModel.updateStatus(issueId, newStatus)` is already implemented. Sprint 8 calls it after each CPGRAMS poll.

---

## 8. Anti-Gaming → Moderation Queue

### Schema

```sql
suspicious_activity (
  id UUID, event_type VARCHAR, entity_type VARCHAR, entity_id UUID,
  severity CHECK ('info','warning','critical'),
  details JSONB, reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ
)
```

### Current implementation

`antiGamingService.runChecks()` fires asynchronously after every support. Flags are written to `suspicious_activity` but **never block the request**.

Checks:

- Velocity: >1000 supports in 10 minutes → `warning`
- IP concentration: >50% from one ip_hash → `warning`
- UA concentration: >70% from one user_agent_hash → `warning`

### Phase 2 Sprint 6 moderation queue

A moderation dashboard (admin-only) will:

1. Query `SELECT * FROM suspicious_activity WHERE reviewed = false ORDER BY created_at DESC`
2. Allow moderators to set `reviewed = true`, `reviewed_by = moderatorId`
3. If issue is confirmed manipulated: auto-flag `issues.discrepancy_score = 0.9`, push to Phase 2 Reality Check (Sprint 11)

---

## 9. Sprint 3 Feed Bridge ✅ DELIVERED (Day 23)

Ranked feed API shipped early — `GET /api/v1/feed` with modes `trending`, `latest`, `critical`, `nearby`. Scoring formula is implemented in `models/issue.js :: FEED_SCORE_EXPR`; per-mode Redis TTLs (30/45/60s) in `utils/cacheKey.js`. See `docs/API.md#feed`.

The following fields are pre-populated for the feed ranking algorithm:

| Field                  | Table  | Populated by                 | Sprint 3 use      |
| ---------------------- | ------ | ---------------------------- | ----------------- |
| `supporter_count`      | issues | supportService               | Trending score    |
| `view_count`           | issues | increment on GET /issues/:id | Engagement metric |
| `share_count`          | issues | future share endpoint        | Virality signal   |
| `comment_count`        | issues | future comment endpoint      | Discussion signal |
| `is_campaign`          | issues | set via PATCH                | Campaign boost    |
| `target_supporters`    | issues | set via PATCH                | Progress bar      |
| `urgency`              | issues | creation                     | Priority boost    |
| `created_at`           | issues | auto                         | Recency decay     |
| `is_verified_location` | issues | EXIF verify                  | Trust signal      |

Sprint 3 will use these to build a ranked feed API (`GET /api/v1/feed`) with a scoring formula roughly:

```
score = (supporter_count × 0.4) + (view_count × 0.1) + (urgency_boost × 0.3)
        + (is_verified_location × 0.1) + (recency_decay × 0.1)
```

No schema changes needed — all fields exist.

---

## Sprint 2 completion note (2026-04-21)

All bridges above are in place. No schema migrations required before Phase 2 Sprint 7 ingestion work begins. Known gaps deferred to Sprint 3 backlog (PHOT-001 route coverage, SRCH-001 searchService coverage, RATE-001 rate-limiter instrumentation, PERF-001 Artillery nightly) are non-blocking for bridge integrity — they affect test coverage, not wire compatibility.
