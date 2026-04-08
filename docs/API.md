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

## Error Codes Reference

| Code               | Typical Status | Description                                         |
| ------------------ | -------------- | --------------------------------------------------- |
| `VALIDATION_ERROR` | 400            | Schema validation failed or invalid input           |
| `UNAUTHORIZED`     | 401            | Missing, invalid, or expired token                  |
| `TOKEN_REUSE`      | 401            | Refresh token reuse detected — all sessions revoked |
| `NOT_FOUND`        | 404            | Requested resource does not exist                   |
| `CONFLICT`         | 409            | Resource already exists (e.g. duplicate phone)      |
| `RATE_LIMITED`     | 429            | Too many requests — see `Retry-After` header        |
| `INTERNAL_ERROR`   | 500            | Unexpected server error                             |

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

| Version | Date       | Changes                                                  |
| ------- | ---------- | -------------------------------------------------------- |
| 1.0.0   | 2026-04-08 | Sprint 1 complete — auth, profile, location, media proxy |
