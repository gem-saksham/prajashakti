# PrajaShakti API Reference — v1

**Base URL:** `http://localhost:3000/api/v1` (dev)  
**Production:** `https://api.prajashakti.in/api/v1`

All endpoints return JSON. Errors follow the envelope:

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

All successful responses follow:

```json
{ "success": true, ... }
```

---

## Authentication

PrajaShakti uses **phone-number OTP authentication**.

### Flow

```
POST /users/register  → sends OTP (first-time only)
POST /users/login     → sends OTP (existing users)
POST /users/verify-otp → verifies OTP, returns access + refresh tokens
```

### Token Types

| Token          | Lifetime   | Storage               |
| -------------- | ---------- | --------------------- |
| `accessToken`  | 15 minutes | Memory / AsyncStorage |
| `refreshToken` | 30 days    | Secure storage only   |

Access tokens are passed as `Authorization: Bearer <token>` on every authenticated request. Refresh tokens are exchanged via `POST /users/refresh` to get a new pair when the access token expires. Token rotation is enforced — each refresh token can only be used once.

---

## Health

### GET /api/health

Simple liveness check. Used by Docker / load balancer.

**Response 200:**

```json
{ "status": "ok" }
```

---

### GET /api/v1/status

Rich status with service latencies and memory usage.

**Response 200:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 3600,
  "services": {
    "postgres": { "status": "connected", "latency_ms": 2 },
    "redis": { "status": "connected", "latency_ms": 1 }
  },
  "memory": {
    "used_mb": 42,
    "total_mb": 64,
    "rss_mb": 80
  }
}
```

---

## Users — Authentication

### POST /api/v1/users/register

Register a new account. Sends OTP to phone number.

**Rate limits:** 5 OTPs/hour per phone, 60s cooldown between sends, 10 req/min per IP.

**Request body:**

```json
{
  "phone": "9100000001",
  "name": "Ravi Kumar"
}
```

| Field   | Type   | Rules                                          |
| ------- | ------ | ---------------------------------------------- |
| `phone` | string | 10 digits, must start with 6–9 (Indian mobile) |
| `name`  | string | 2–100 characters                               |

**Response 200:**

```json
{
  "success": true,
  "message": "OTP sent to your mobile number",
  "debug_otp": "123456"
}
```

> `debug_otp` is only present in non-production environments.

**Errors:**

| Code               | Status | Meaning                                         |
| ------------------ | ------ | ----------------------------------------------- |
| `CONFLICT`         | 409    | Phone already registered — use `/login` instead |
| `RATE_LIMITED`     | 429    | Too many OTP requests (hourly cap or cooldown)  |
| `VALIDATION_ERROR` | 400    | Invalid phone number or name                    |

---

### POST /api/v1/users/login

Send OTP to an existing registered phone number.

**Rate limits:** Same as `/register`.

**Request body:**

```json
{ "phone": "9100000001" }
```

**Response 200:**

```json
{
  "success": true,
  "message": "OTP sent to your mobile number",
  "debug_otp": "123456"
}
```

**Errors:**

| Code           | Status | Meaning               |
| -------------- | ------ | --------------------- |
| `NOT_FOUND`    | 404    | Phone not registered  |
| `RATE_LIMITED` | 429    | Too many OTP requests |

---

### POST /api/v1/users/verify-otp

Verify OTP and receive authentication tokens.

**Rate limits:** 3 wrong attempts → 15-minute lockout, 10 req/min per IP.

**Request body:**

```json
{
  "phone": "9100000001",
  "otp": "123456"
}
```

**Response 200:**

```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "a3b4c5...",
  "user": {
    "id": "uuid",
    "phone": "9100000001",
    "name": "Ravi Kumar",
    "role": "citizen",
    "isVerified": false,
    "avatarUrl": null,
    "bio": null,
    "district": null,
    "state": null,
    "pincode": null,
    "profileCompleteness": 30,
    "profileSuggestions": ["Add a profile photo", "Write a short bio"],
    "createdAt": "2026-04-01T10:00:00Z",
    "lastLoginAt": "2026-04-08T10:00:00Z"
  }
}
```

**Errors:**

| Code               | Status | Meaning                              |
| ------------------ | ------ | ------------------------------------ |
| `VALIDATION_ERROR` | 400    | Wrong OTP, shows remaining attempts  |
| `RATE_LIMITED`     | 429    | Phone locked after too many failures |

---

### POST /api/v1/users/refresh

Exchange a refresh token for a new access + refresh token pair. Implements rotation — each refresh token is single-use.

**Request body:**

```json
{ "refreshToken": "a3b4c5..." }
```

**Response 200:**

```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "d4e5f6...",
  "user": { ... }
}
```

**Errors:**

| Code           | Status | Meaning                                              |
| -------------- | ------ | ---------------------------------------------------- |
| `UNAUTHORIZED` | 401    | Token invalid, expired, or already used              |
| `TOKEN_REUSE`  | 401    | Security alert: reuse detected, all sessions revoked |

---

### POST /api/v1/users/logout

Blacklist the current access token and revoke the refresh token.

**Headers:** `Authorization: Bearer <accessToken>`

**Request body:**

```json
{ "refreshToken": "a3b4c5..." }
```

**Response 200:**

```json
{ "success": true, "message": "Logged out successfully" }
```

---

## Users — Profile

All profile endpoints require `Authorization: Bearer <accessToken>`.

### GET /api/v1/users/me

Get the authenticated user's full profile including completeness score.

**Response 200:**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "phone": "9100000001",
    "name": "Ravi Kumar",
    "email": null,
    "bio": "Activist from Bengaluru",
    "avatarUrl": "https://s3.../avatars/uuid/photo.jpg",
    "district": "Bengaluru Urban",
    "state": "Karnataka",
    "pincode": "560001",
    "locationLat": 12.9716,
    "locationLng": 77.5946,
    "role": "citizen",
    "isVerified": false,
    "reputationScore": 0,
    "profileCompleteness": 75,
    "profileSuggestions": ["Verify with Aadhaar"],
    "createdAt": "2026-04-01T10:00:00Z",
    "lastLoginAt": "2026-04-08T10:00:00Z"
  }
}
```

> `profileSuggestions` is only present when `profileCompleteness < 60`.

---

### PATCH /api/v1/users/me

Update mutable profile fields. At least one field required.

**Request body** (all fields optional):

```json
{
  "name": "Ravi Kumar",
  "email": "ravi@example.com",
  "bio": "Activist from Bengaluru",
  "district": "Bengaluru Urban",
  "state": "Karnataka",
  "pincode": "560001",
  "locationLat": 12.9716,
  "locationLng": 77.5946
}
```

| Field         | Type   | Rules                         |
| ------------- | ------ | ----------------------------- |
| `name`        | string | 2–100 chars                   |
| `email`       | string | Valid email format            |
| `bio`         | string | Max 500 chars, HTML sanitised |
| `district`    | string | Max 100 chars                 |
| `state`       | string | Max 100 chars                 |
| `pincode`     | string | Exactly 6 digits              |
| `locationLat` | number | -90 to 90                     |
| `locationLng` | number | -180 to 180                   |

**Response 200:**

```json
{ "success": true, "user": { ... } }
```

---

### POST /api/v1/users/me/avatar-upload-url

Get a pre-signed S3 PUT URL for direct avatar upload from web clients.

**Request body:**

```json
{ "fileType": "image/jpeg" }
```

`fileType` must be one of: `image/jpeg`, `image/png`, `image/webp`.

**Response 200:**

```json
{
  "success": true,
  "uploadUrl": "https://s3.localhost.localstack.cloud:4566/prajashakti/avatars/uuid/filename.jpg?...",
  "publicUrl": "https://s3.../avatars/uuid/filename.jpg",
  "key": "avatars/uuid/filename.jpg"
}
```

After upload, call `PATCH /me` with `{ "avatarUrl": "<publicUrl>" }` to save it.

---

### POST /api/v1/users/me/avatar

Upload avatar directly (binary body). Used by mobile clients that cannot reach S3 directly.

**Headers:**

- `Authorization: Bearer <accessToken>`
- `Content-Type: image/jpeg` (or `image/png` / `image/webp`)

**Request body:** Raw image bytes.

**Response 200:**

```json
{
  "success": true,
  "publicUrl": "https://s3.../avatars/uuid/filename.jpg",
  "user": { ... }
}
```

---

### DELETE /api/v1/users/me/avatar

Remove current avatar from S3 and clear it in the database.

**Response 200:**

```json
{ "success": true, "user": { ... } }
```

---

### POST /api/v1/users/link/google

Link a Google account to an existing phone-registered account.

**Request body:**

```json
{ "idToken": "google-id-token" }
```

**Response 200:**

```json
{ "success": true, "user": { ... } }
```

**Errors:**

| Code           | Status | Meaning                                       |
| -------------- | ------ | --------------------------------------------- |
| `UNAUTHORIZED` | 401    | Invalid Google token                          |
| `CONFLICT`     | 409    | Google account already linked to another user |

---

### POST /api/v1/users/verify-aadhaar

Initiate Aadhaar identity verification (stub in Sprint 1).

**Response 200:**

```json
{
  "success": true,
  "message": "Aadhaar verification is not yet enabled. Coming soon.",
  "status": "pending"
}
```

---

## Users — Public Profiles

### GET /api/v1/users/:id

Get a public profile. Phone number and email are never included.

**Path params:** `id` — UUID of the user.

**Response 200:**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Ravi Kumar",
    "avatarUrl": "https://s3.../avatars/...",
    "bio": "Activist from Bengaluru",
    "district": "Bengaluru Urban",
    "state": "Karnataka",
    "role": "citizen",
    "isVerified": false,
    "reputationScore": 0,
    "stats": {
      "issuesRaised": 0,
      "issuesSupported": 0,
      "comments": 0
    },
    "joinedAt": "2026-04-01T10:00:00Z",
    "lastActiveAt": "2026-04-08T10:00:00Z"
  }
}
```

---

### GET /api/v1/users/:id/activity

Paginated public activity feed for a user.

**Query params:**

| Param   | Default | Max |
| ------- | ------- | --- |
| `page`  | 1       | —   |
| `limit` | 20      | 50  |

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "login",
      "description": null,
      "metadata": {},
      "createdAt": "2026-04-08T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

---

## Location

All location endpoints require authentication to prevent abuse of the Nominatim geocoding service.

### GET /api/v1/location/detect

Auto-detect location from the request's IP address using ip-api.com.

**Response 200:**

```json
{
  "success": true,
  "location": {
    "lat": 12.9716,
    "lng": 77.5946,
    "district": "Bengaluru Urban",
    "state": "Karnataka",
    "country": "India"
  }
}
```

> Returns `{ "location": null }` for private/loopback IPs or when detection fails.

---

### GET /api/v1/location/reverse

Convert GPS coordinates to an address.

**Query params:**

- `lat` (required): Latitude (-90 to 90)
- `lng` (required): Longitude (-180 to 180)

**Response 200:**

```json
{
  "success": true,
  "location": {
    "district": "Bengaluru Urban",
    "state": "Karnataka",
    "pincode": "560001",
    "formattedAddress": "MG Road, Bengaluru, Karnataka 560001, India"
  }
}
```

---

### GET /api/v1/location/nearby-issues

Find issues within a radius of a geo point. Geo filter is applied server-side via PostGIS/Haversine; use `/feed?mode=nearby` for the ranked/scored variant.

> Note: this is exposed as `GET /api/v1/issues/nearby` — see Issues section.

---

### GET /api/v1/location/jurisdiction

Rich jurisdiction for a coordinate (state + district + LGD codes). Requires auth.

**Request:**

```
GET /api/v1/location/jurisdiction?lat=28.6139&lng=77.2090
Authorization: Bearer <access>
```

**Response 200:**

```json
{
  "success": true,
  "jurisdiction": {
    "state": { "code": "DL", "name": "Delhi", "type": "ut" },
    "district": { "code": "DL01", "name": "New Delhi", "lgdCode": "140" },
    "zone": "North"
  }
}
```

**Errors:** `400 OUTSIDE_INDIA` if coordinates fall outside the Indian bounding box.

---

### GET /api/v1/location/responsible-departments

Rank departments responsible for a given coordinate + category.

**Request:**

```
GET /api/v1/location/responsible-departments?lat=28.6&lng=77.2&category=Infrastructure
Authorization: Bearer <access>
```

**Response 200:** `{ success, departments: [{ id, name, ministry, score }] }`

---

### GET /api/v1/location/search

Forward geocoding / location autocomplete for Indian places.

**Query params:**

- `q` (required): Search query, 2–200 characters

**Response 200:**

```json
{
  "success": true,
  "results": [
    {
      "displayName": "Bengaluru, Karnataka, India",
      "lat": 12.9716,
      "lng": 77.5946,
      "district": "Bengaluru Urban",
      "state": "Karnataka"
    }
  ]
}
```

---

## Media Proxy

### GET /api/v1/media/:path

Serve files from S3 through the API server. Used by clients that cannot reach S3 (LocalStack port 4566) directly.

**Path:** Any path under `avatars/`, `issues/`, or `evidence/` prefixes.

**Examples:**

- `GET /api/v1/media/avatars/uuid/photo.jpg`
- `GET /api/v1/media/issues/uuid/evidence.jpg`

**Response 200:** Binary image data with appropriate `Content-Type`.

**Errors:**

| Status | Meaning                                     |
| ------ | ------------------------------------------- |
| 400    | Path traversal attempt or disallowed prefix |
| 404    | File not found in S3                        |

---

## Issues

Core citizen-issue entity. CPGRAMS-aligned taxonomy (ministry / department / grievance category) and PostGIS-backed geo queries.

### POST /api/v1/issues

Create a new issue. Requires auth; rate-limited to 5 issues / hour per user.

**Request:**

```
POST /api/v1/issues
Authorization: Bearer <access>
Content-Type: application/json

{
  "title": "Broken streetlight on MG Road",
  "description": "Pole #42 has been dark for 3 weeks; area unsafe after dusk.",
  "category": "Infrastructure",
  "urgency": "high",
  "location_lat": 28.6139,
  "location_lng": 77.2090,
  "district": "New Delhi",
  "state": "DL",
  "ministry_id": "aaaaaaaa-0001-...",
  "department_id": "bbbbbbbb-0001-...",
  "grievance_category_id": "cccccccc-0001-...",
  "tracking_ids": { "cpgrams": "DOPTG/2026/00042" }
}
```

**Response 201:** `{ success: true, data: <Issue> }` — full issue with `id`, `supporter_count: 0`, `view_count: 0`, `status: "active"`, joined creator/ministry/department.

**Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `429 RATE_LIMITED`.

---

### GET /api/v1/issues

List issues with filters, sort, pagination.

**Query params:**

| Param                         | Type   | Default     | Notes                                                                                                         |
| ----------------------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `page`                        | int    | 1           |                                                                                                               |
| `limit`                       | int    | 20          | max 100                                                                                                       |
| `sort`                        | enum   | `newest`    | `newest` / `oldest` / `most_supported` / `most_urgent` / `most_viewed`                                        |
| `category`                    | enum   | —           |                                                                                                               |
| `urgency`                     | enum   | —           | `low`/`medium`/`high`/`critical`                                                                              |
| `status`                      | enum   | —           | `active`/`trending`/`escalated`/`officially_resolved`/`citizen_verified_resolved`/`citizen_disputed`/`closed` |
| `district`, `state`           | string | —           |                                                                                                               |
| `is_campaign`                 | bool   | —           |                                                                                                               |
| `search`                      | string | —           | full-text search across title+description                                                                     |
| `min_support`                 | int    | 0           |                                                                                                               |
| `date_range`                  | enum   | `all`       | `24h`/`7d`/`30d`/`all`                                                                                        |
| `has_photos`, `verified_only` | bool   | —           |                                                                                                               |
| `lat`, `lng`, `radius_km`     | number | radius 10km | geo filter                                                                                                    |

**Response 200:** `{ success, data: Issue[], pagination: { page, limit, total, totalPages } }`.

---

### GET /api/v1/issues/:id

Single issue with creator, ministry, department, category joined. Increments `view_count` (async, deduped per session).

**Response 200:** `{ success, data: <Issue> }`

---

### GET /api/v1/issues/stats

Aggregate counters (public, Redis-cached 60s).

**Response 200:**

```json
{
  "success": true,
  "data": {
    "total": 503,
    "active": 420,
    "trending": 12,
    "escalated": 5,
    "resolved": 66,
    "totalSupporters": 6013
  }
}
```

---

### GET /api/v1/issues/nearby

Geo search within radius. `GET /api/v1/issues/nearby?lat=28.6&lng=77.2&radius_km=5&limit=20`.

**Response 200:** `{ success, data: Issue[], count }` (sorted by distance; each entry includes `distance_km`).

---

### GET /api/v1/issues/jurisdiction

Issues filed under a state / district.

```
GET /api/v1/issues/jurisdiction?state_code=DL&district_code=DL01&page=1&limit=20
```

---

### GET /api/v1/issues/bbox

Issues inside a bounding box (for map tiles).

```
GET /api/v1/issues/bbox?min_lat=28.5&min_lng=77.1&max_lat=28.7&max_lng=77.3&limit=100
```

---

### GET /api/v1/issues/me

Current user's own issues. Requires auth. Same pagination/sort as `GET /issues`.

---

### GET /api/v1/issues/:id/related

Top-N related issues (same category + geo proximity). `?limit=3` (max 10).

---

### PATCH /api/v1/issues/:id

Update an issue. Only the creator may edit. Mass-assignment stripped — cannot change `status`, `supporter_count`, `view_count`.

**Errors:** `401`, `403 FORBIDDEN` (non-creator), `400 VALIDATION_ERROR`.

---

### DELETE /api/v1/issues/:id

Soft-delete. Sets `status = "closed"` and excludes from default listings. Only the creator or an admin may delete.

---

## Photos

Multi-photo pipeline for issue evidence. S3-backed, EXIF-verified.

### POST /api/v1/issues/:issueId/photos/upload-url

Request a pre-signed S3 PUT URL. Only the issue creator may call. Max 5 photos per issue.

**Request body:** `{ "file_type": "image/jpeg" }` (also `image/png`, `image/webp`).

**Response 200:**

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3.../issues/<issueId>/<photoKey>.jpg?X-Amz-...",
    "fileKey": "issues/<issueId>/<photoKey>.jpg",
    "expiresIn": 900
  }
}
```

---

### POST /api/v1/issues/:issueId/photos/confirm

After a successful PUT to `uploadUrl`, confirm to run EXIF extraction + haversine check vs. issue location. Photo is appended to `issues.photos` JSONB.

**Request body:** `{ "file_key": "issues/<issueId>/<photoKey>.jpg" }`.

**Response 201:**

```json
{
  "success": true,
  "data": {
    "url": "https://s3.../issues/...",
    "fileKey": "issues/...",
    "verified": true,
    "exifGps": { "lat": 28.614, "lng": 77.209 },
    "distanceM": 38,
    "uploadedAt": "2026-04-21T10:12:00Z"
  }
}
```

`verified: false` when EXIF GPS absent or >250m from issue location (`is_verified_location` remains false).

---

### DELETE /api/v1/issues/:issueId/photos/:photoKey

Remove a photo. `photoKey` is base64url-encoded on client so slashes survive URL transport. Creator or admin only.

---

## Government — Taxonomy

Public read-only taxonomy (97 ministries, 167 departments, ~80 grievance categories). Redis-cached 24h.

### GET /api/v1/government/ministries

```
GET /api/v1/government/ministries?type=central
```

`type` ∈ `central`, `state`, `ut` (optional).

**Response 200:** `{ success, data: Ministry[], count }`.

---

### GET /api/v1/government/ministries/:id

Single ministry by UUID.

---

### GET /api/v1/government/ministries/search?q=health

ILIKE search on ministry name. Min length 2.

---

### GET /api/v1/government/ministries/:id/departments

Departments under a ministry.

---

### GET /api/v1/government/departments/:id

Single department with ministry info joined.

---

### GET /api/v1/government/departments/search?q=water

---

### GET /api/v1/government/categories

```
GET /api/v1/government/categories?praja_category=Infrastructure
```

Optional `praja_category` filter.

---

### GET /api/v1/government/categories/:slug

Single category by slug.

---

### GET /api/v1/government/categories/suggest?q=broken streetlight

NLP keyword → grievance category match. `q` is 3–500 chars. Not cached (dynamic).

**Response 200:** `{ success, data: [{ id, slug, name, score }], count }`.

---

## Officials

Bureaucrat / elected-official directory. Used for tagging officials to issues.

### GET /api/v1/officials

List or search. When `q` is provided, uses fuzzy search; otherwise paginated.

**Query params:** `q`, `state_code`, `district_code`, `jurisdiction_type` (`national`/`state`/`district`/`municipal`/`local`), `page`, `limit`.

**Response 200:** list mode `{ success, data, pagination }`, search mode `{ success, data, count }`.

---

### GET /api/v1/officials/:id

Single official + accountability stats (tagged issues, response times).

---

### POST /api/v1/officials

Create an official. Moderator / admin only.

**Body:** `name`, `designation` (required), optional `department_id`, `ministry_id`, `jurisdiction_type`, `jurisdiction_code`, `state_code`, `district_code`, `public_email`, `public_phone`, `office_address`, `twitter_handle`, `cadre`, `batch_year`, `source`, `is_verified`.

---

### POST /api/v1/officials/:id/claim

Authenticated user requests to claim an official account. Triggers manual verification workflow.

---

### GET /api/v1/issues/:issueId/officials

List officials tagged to an issue (public).

---

### POST /api/v1/issues/:issueId/officials

Tag an official to an issue. Requires auth.

**Body:**

```json
{ "official_id": "uuid", "tag_type": "primary" }
```

`tag_type` ∈ `primary`, `escalation`, `mentioned`. Unique (issue, official) — cannot tag the same official twice.

---

### DELETE /api/v1/issues/:issueId/officials/:officialId

Untag. Creator, tagging user, or admin.

---

## Supports

Weighted support counters for an issue.

Weights: unverified user 0.5×, verified 1.0×, leader 1.2×, admin 1.3×. Rate-limited to 60 supports/minute per user.

### POST /api/v1/issues/:id/support

Support an issue. Atomic: PostgreSQL upsert + Redis counter. Emits anti-gaming check.

**Response 201:**

```json
{
  "success": true,
  "data": {
    "supported": true,
    "supporterCount": 142,
    "weight": 1.0,
    "milestoneReached": null
  }
}
```

`milestoneReached` is one of `{100, 500, 1000, 5000, 10000}` when the count crosses the threshold.

**Errors:** `401`, `409 ALREADY_SUPPORTED`, `400 ISSUE_CLOSED`, `429`.

---

### DELETE /api/v1/issues/:id/support

Remove support. Decrements atomically.

---

### GET /api/v1/issues/:id/supporters

Paginated supporters list. `?page=1&limit=20`. If authenticated, adds `hasSupported` flag.

---

### GET /api/v1/issues/:id/support-stats

```json
{
  "success": true,
  "data": {
    "supporterCount": 142,
    "weightedCount": 168.4,
    "velocity24h": 28,
    "nextMilestone": 500,
    "hasSupported": false
  }
}
```

---

### GET /api/v1/users/:userId/supported

Issues a user has supported. Paginated.

---

## Search

### GET /api/v1/search/suggest

Autocomplete suggestions against issues + tags. <100 ms target, Redis-cached.

```
GET /api/v1/search/suggest?q=street&limit=5
```

**Response 200:** `{ success, suggestions: [{ id, title, score, type }], cached: boolean }`.

---

### POST /api/v1/search/log

Analytics: record a completed search. Body: `{ query, filters?, resultCount?, sessionId? }`. `200 { success: true }`.

---

### POST /api/v1/search/click

CTR measurement. Body: `{ query, issueId, sessionId? }`.

---

## Tag Suggestions

### POST /api/v1/issues/suggest-tags

Called debounced (500 ms) as the user types the issue creation form. Returns ranked suggestions across grievance categories, ministries, departments, and officials. Rate-limited to 20/hour per user.

**Request body:**

```json
{
  "title": "Potholes flooding the road",
  "description": "Every monsoon the entire stretch from ...",
  "category": "Infrastructure",
  "location_lat": 28.6139,
  "location_lng": 77.209
}
```

**Response 200:**

```json
{
  "success": true,
  "suggestions": {
    "grievanceCategories": [{ "id": "...", "slug": "road-infrastructure", "score": 8.4 }],
    "ministries": [{ "id": "...", "name": "Ministry of Road Transport & Highways" }],
    "departments": [{ "id": "...", "name": "PWD — Roads" }],
    "suggestedOfficials": [{ "id": "...", "name": "...", "designation": "..." }]
  }
}
```

---

## Feed

### GET /api/v1/feed

Ranked composite feed. Optional auth (same feed; personalisation is Phase 2).

**Modes** (query `mode`):

| Mode                 | Behaviour                                                         |
| -------------------- | ----------------------------------------------------------------- |
| `trending` (default) | engagement + urgency + recency + location-trust score             |
| `latest`             | newest first, score still returned                                |
| `critical`           | urgency ∈ {critical, high}, sorted by score                       |
| `nearby`             | requires `lat`/`lng`; sorted by score; each item has `distanceKm` |

**Score formula (SQL):**

```
LN(1 + supporter_count) × 0.4  — engagement
LN(1 + view_count)      × 0.1  — views
urgency_boost           × 0.3  — critical=4, high=3, medium=2, low=1
is_verified_location    × 0.1  — EXIF-verified trust signal
recency_decay           × 0.1  — 1 / (1 + days_old × 0.1)
```

**Query params:** `mode`, `lat`, `lng`, `radius_km` (default 20, max 100), `category`, `urgency`, `state`, `district`, `is_campaign`, `page`, `limit` (max 50).

**Cache:** Redis, per-mode TTL — trending 30s, nearby 45s, latest/critical 60s.

**Response 200:**

```json
{
  "success": true,
  "data": [{ "...issue": "...", "feedScore": 2.341, "distanceKm": 1.234 }],
  "pagination": { "page": 1, "limit": 20, "total": 500, "totalPages": 25 },
  "meta": { "mode": "nearby", "lat": 28.61, "lng": 77.2, "radiusKm": 20 }
}
```

---

## Error Codes Reference

| Code                | Typical Status | Description                                         |
| ------------------- | -------------- | --------------------------------------------------- |
| `VALIDATION_ERROR`  | 400            | Schema validation failed or invalid input           |
| `UNAUTHORIZED`      | 401            | Missing, invalid, or expired token                  |
| `TOKEN_REUSE`       | 401            | Refresh token reuse detected — all sessions revoked |
| `NOT_FOUND`         | 404            | Requested resource does not exist                   |
| `CONFLICT`          | 409            | Resource already exists (e.g. duplicate phone)      |
| `RATE_LIMITED`      | 429            | Too many requests — see `Retry-After` header        |
| `INTERNAL_ERROR`    | 500            | Unexpected server error                             |
| `FORBIDDEN`         | 403            | Not the creator / insufficient role                 |
| `ISSUE_CLOSED`      | 400            | Cannot support / modify a closed issue              |
| `ALREADY_SUPPORTED` | 409            | User has already supported this issue               |
| `OUTSIDE_INDIA`     | 400            | Coordinates outside the Indian bounding box         |
| `STATE_NOT_FOUND`   | 404            | State code not recognised                           |

---

## Rate Limits

| Scope                                                 | Limit      | Window        |
| ----------------------------------------------------- | ---------- | ------------- |
| Global (per IP)                                       | 100 req    | 1 minute      |
| Auth endpoints (`/register`, `/login`, `/verify-otp`) | 10 req     | 1 minute      |
| OTP sends (per phone)                                 | 5 OTPs     | 1 hour        |
| OTP cooldown (per phone)                              | 1 OTP      | 60 seconds    |
| Failed OTP attempts (per phone)                       | 3 attempts | → 15-min lock |
| Issue creation (Sprint 2)                             | 5 issues   | 1 hour        |

Rate limit responses include headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (Unix timestamp)

---

## Interactive Docs (Development Only)

Swagger UI is available at `http://localhost:3000/api/docs` when running in development or test mode.

---

## Changelog

| Version | Date       | Changes                                                                                                      |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| 1.0.0   | 2026-04-08 | Sprint 1 complete — auth, profile, location, media proxy                                                     |
| 1.1.0   | 2026-04-21 | Sprint 2 complete — issues CRUD, photos, taxonomy, officials, supports, search, tag suggestions, ranked feed |
