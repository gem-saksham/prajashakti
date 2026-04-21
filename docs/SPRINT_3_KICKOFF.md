# Sprint 3 Kickoff — The Feed

**Sprint:** 3 (Days 31–45)
**Start:** 2026-04-22
**Working title:** "The Feed" — personalisation, discussion, notifications
**Team:** Solo (Platform Engineering)

---

## Goal

Turn the platform from a **write-mostly issue tracker** into a **read-first civic social graph**. By end of Sprint 3 a citizen opening the app should see a feed that feels relevant (their district, their categories, their supports) and can react, comment, and be notified when the issues they support move forward.

---

## What's Already Done (Pulled Forward from Sprint 2)

- ✅ `GET /api/v1/feed` with modes `trending`, `latest`, `critical`, `nearby` (Day 23)
- ✅ Composite scoring formula (engagement + urgency + recency + location-trust)
- ✅ Per-mode Redis TTL caching (30/45/60s)
- ✅ Offline feed caching on mobile (AsyncStorage, 24h TTL) — Day 28
- ✅ `notifications` table schema (empty, waiting on producers)
- ✅ Mobile swipe-to-support, pull-to-refresh haptics, deep linking

Sprint 3 builds **on top of** the feed, not from scratch.

---

## Backlog (carried from Sprint 2)

Before new work, close these P2 tickets. They're small and they make Sprint 3's ground firmer.

| ID       | Title                                                              | Target           | Estimate |
| -------- | ------------------------------------------------------------------ | ---------------- | -------- |
| SRCH-001 | `searchService` test suite                                         | 6% → 80%         | 1 day    |
| PHOT-001 | Route-level integration test for photos upload+confirm             | 19% → 75%        | 0.5 day  |
| GOV-001  | Integration tests for ministries / departments / categories routes | 14% → 75%        | 0.5 day  |
| RATE-001 | Instrumented rate-limiter test (NODE_ENV override)                 | 16% → 70%        | 0.5 day  |
| PERF-001 | Wire Artillery YAMLs into nightly job + capture P95                | Dashboard exists | 1 day    |

**Total:** 3.5 days. Schedule: Days 31–34.

---

## Sprint 3 Features (Days 35–45)

### Phase A — Personalisation (Days 35–37)

1. **Home feed = Trending + Nearby blend** — for authenticated users, interleave feed entries by a weighted mix (70% trending, 30% nearby within 50km). Unauth users get pure trending.
2. **Following graph (lightweight)** — `user_follows (follower_id, followed_user_id)` + `user_follows_category` + `user_follows_official`. New endpoint: `POST /api/v1/users/:id/follow`, `POST /api/v1/categories/:slug/follow`, `POST /api/v1/officials/:id/follow`.
3. **Feed mode: `following`** — issues from followed users/categories/officials, sorted by score.

### Phase B — Comments & Reactions (Days 38–40)

4. **Comments** — `comments (id, issue_id, user_id, parent_id, body, created_at, reactions_json, hidden_reason)`. Threaded 1 level deep.
5. **Reactions** — `reactions (user_id, target_type, target_id, reaction_type)` where `target_type ∈ {issue, comment}`, `reaction_type ∈ {support, concern, question, duplicate}`. Distinct from "supports" — these are low-weight engagement signals, not accountability votes.
6. **Moderation hooks** — soft-delete (`hidden_reason`) visible to moderators, counts towards `suspicious_activity` if rate spike.

### Phase C — Notifications (Days 41–43)

7. **In-app notifications** — producer on `issue.milestone.reached`, `comment.received`, `official.tagged`, `status.changed`. Consumer: `GET /api/v1/notifications` paginated, `PATCH /:id/read`, `POST /mark-all-read`.
8. **Mobile push via Expo Notifications** — register device tokens, send on milestone+comment events. Reuse `globalThis.__navigateToIssue` from Day 28.
9. **Notification preferences** — user opt-out per type (milestone/comment/mention/official). `PATCH /me/notifications/prefs`.

### Phase D — Stretch (Days 44–45)

10. **Campaign view** — issues with `is_campaign=true` get a /campaigns feed variant with progress-bar UI and milestone celebrations.
11. **Issue timeline** — a chronological activity feed per issue (supports, comments, status changes, photos added).
12. **Review + Sprint 3 QA day** — 470 → target ~650 tests.

---

## Non-goals (explicitly out of scope)

- NLP classification of issues (Phase 2 Sprint 9)
- CPGRAMS status sync (Phase 2 Sprint 8)
- Kafka migration (Phase 2 Sprint 5) — event bus stays as EventEmitter
- RTI auto-generator (Phase 1 Sprint 4)
- Video stories (Phase 1 Sprint 4)
- Payment / donation flow (later)
- Web app feature parity — web gets comments read-only; full wizard stays Sprint-2-era

---

## Success Metrics

| Metric                       |             Target |
| ---------------------------- | -----------------: |
| Total Jest tests             |              ≥ 620 |
| Overall statement coverage   |              ≥ 75% |
| Services coverage            |              ≥ 85% |
| Routes coverage              |              ≥ 78% |
| Feed P95 (500-issue seed)    |            < 120ms |
| Notifications throughput     | 10k/min in-process |
| P0 / P1 bugs at sprint close |                  0 |

---

## Risks

**Notification fan-out.** Milestone events at 10k supporters emit one notification per follower. Need to paginate the producer (batch 1000/iteration) or cap to "top 1000 earliest supporters" until Phase 2 Sprint 5 Kafka.

**Comment abuse.** First public write surface for free-form text. Must run through the existing sanitiser (`ROUTE_SCHEMAS` gets `comment.body` added) and rate-limit at 10 comments/hour/user in prod.

**Following graph growth.** If a user follows 500 categories, the personalised feed JOIN gets expensive. Materialise to Redis on first query, invalidate on follow change.

**Mobile push cert setup.** Expo managed certificates handle dev; production APNs + FCM keys need to be configured in the Expo dashboard before Day 41.

---

## Definition of Done (Sprint 3)

- All Sprint 2 P2 backlog tickets closed or explicitly re-deferred with ticket + owner
- Feed returns a personalised blend for logged-in users
- Comments + reactions work end-to-end (API + web + mobile)
- Notifications: in-app + mobile push, with preferences
- 620+ Jest tests, all green
- Coverage ≥ 75% overall
- `docs/API.md` updated with new endpoints
- `docs/retrospectives/SPRINT_3.md` written
- Git tag `sprint-3-complete`

---

## Day 1 checklist (2026-04-22)

- [ ] Read `docs/retrospectives/SPRINT_2.md`
- [ ] Read `docs/SPRINT_2_QA.md` (the ⚠️ rows drive Phase A scoping)
- [ ] Start SRCH-001: `apps/api/tests/services/search.test.js`
- [ ] Open a PR per backlog item, not one big PR
