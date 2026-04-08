# Sprint 2 Kickoff

**Start Date:** Day 16 (2026-04-09)  
**Theme:** Issues — Core Content Type  
**Goal:** Citizens can report public issues, browse them by location and category, and support issues raised by others.

---

## Sprint Goal

By end of Sprint 2, a citizen should be able to:

1. Report a public issue (title, description, category, location, photo evidence)
2. Browse issues near their location or filtered by category
3. Support an issue (single-tap, shows real-time counter)
4. See a basic accountability dashboard for the responsible official

Sprint 2 is the first sprint where the app has substantive user-facing content — the auth foundation from Sprint 1 is the prerequisite.

---

## Architecture Decisions Going In

### New Data Models

**`issues` table** (core entity)

```sql
id            UUID PK
user_id       UUID FK → users
title         TEXT
description   TEXT
category      TEXT  -- pothole, water, electricity, corruption, etc.
status        TEXT  -- open, acknowledged, in_progress, resolved
district      TEXT
state         TEXT
pincode       TEXT
location_lat  NUMERIC
location_lng  NUMERIC
supporter_count INTEGER DEFAULT 0
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

**`issue_media` table** (evidence photos/videos)

```sql
id          UUID PK
issue_id    UUID FK → issues
user_id     UUID FK → users
media_url   TEXT
media_type  TEXT  -- image, video
caption     TEXT
created_at  TIMESTAMPTZ
```

**`issue_supporters` table** (normalised support count)

```sql
issue_id    UUID FK → issues
user_id     UUID FK → users
created_at  TIMESTAMPTZ
PRIMARY KEY (issue_id, user_id)
```

**`officials` table** (accountability tracker)

```sql
id            UUID PK
name          TEXT
designation   TEXT
department    TEXT
district      TEXT
state         TEXT
email         TEXT
phone         TEXT
office_address TEXT
created_at    TIMESTAMPTZ
```

**`issue_officials` table** (which officials are responsible for which issues)

```sql
issue_id    UUID FK → issues
official_id UUID FK → officials
assigned_at TIMESTAMPTZ
PRIMARY KEY (issue_id, official_id)
```

---

## Planned API Endpoints

### Issues CRUD

| Method | Path                 | Auth       | Description        |
| ------ | -------------------- | ---------- | ------------------ |
| POST   | `/api/v1/issues`     | Required   | Create issue       |
| GET    | `/api/v1/issues`     | Optional   | List/search issues |
| GET    | `/api/v1/issues/:id` | Optional   | Get issue detail   |
| PATCH  | `/api/v1/issues/:id` | Owner only | Update issue       |
| DELETE | `/api/v1/issues/:id` | Owner only | Delete issue       |

### Issue Actions

| Method | Path                                | Auth       | Description      |
| ------ | ----------------------------------- | ---------- | ---------------- |
| POST   | `/api/v1/issues/:id/support`        | Required   | Support an issue |
| DELETE | `/api/v1/issues/:id/support`        | Required   | Withdraw support |
| POST   | `/api/v1/issues/:id/media`          | Required   | Upload evidence  |
| DELETE | `/api/v1/issues/:id/media/:mediaId` | Owner only | Remove evidence  |

### Officials

| Method | Path                           | Auth     | Description                 |
| ------ | ------------------------------ | -------- | --------------------------- |
| GET    | `/api/v1/officials`            | Optional | List officials              |
| GET    | `/api/v1/officials/:id`        | Optional | Official profile + stats    |
| GET    | `/api/v1/officials/:id/issues` | Optional | Issues assigned to official |

---

## Front-End Changes

### Web App

- Issues feed (home tab) replaces placeholder content
- Create Issue modal with full form + location picker + photo upload
- Issue detail page with supporter counter, timeline, evidence wall
- Officials tab (basic accountability profiles)

### Mobile App

- Issues tab: scrollable feed, category filter pills
- Create Issue flow (multi-step: details → location → photo)
- Issue detail screen: support button, evidence gallery
- Officials tab: list + detail screen

---

## Day Plan (Rough)

| Day | Focus                                                |
| --- | ---------------------------------------------------- |
| 16  | Issues model, migrations, CRUD routes, tests         |
| 17  | Issues search + filters (category, location, status) |
| 18  | Issue support (toggle, atomic counter, dedup)        |
| 19  | Issue media upload (multi-image, S3)                 |
| 20  | Officials model + routes + assignment                |
| 21  | Web feed + create issue UI                           |
| 22  | Web issue detail + supporter counter                 |
| 23  | Mobile feed + create issue screens                   |
| 24  | Mobile issue detail + support action                 |
| 25  | Officials screens (web + mobile)                     |
| 26  | AI integration: issue analysis, RTI draft            |
| 27  | Real-time support counter (SSE or polling)           |
| 28  | Notifications (in-app, sprint 2 scope only)          |
| 29  | Sprint 2 QA + bug fixes                              |
| 30  | Sprint 2 retrospective + Sprint 3 kickoff            |

---

## Technical Debt to Address in Sprint 2

From [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md):

- TD-01 — securityCheck.js test coverage
- TD-02 — Real SMS OTP provider (MSG91)
- TD-04 — Avatar crop/compression
- TD-08 — Vitest migration (if time permits)
- TD-12 — LocalStack persistent volume
- TD-13 — External service request timeouts

---

## Definition of Done for Sprint 2

- [ ] Citizens can create, view, and browse issues
- [ ] Issues can be filtered by category, location (district), and status
- [ ] Support action is atomic (no double-counting) and reflected in real-time
- [ ] Evidence photos uploadable per issue
- [ ] Officials are linked to issues and have a basic accountability page
- [ ] All new endpoints have integration tests
- [ ] Coverage stays above 60% overall
- [ ] QA checklist completed and signed off
