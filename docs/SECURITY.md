# PrajaShakti — Security Documentation

> यत्र प्रजाशक्तिः तत्र सुशासनम् — Where there is the power of citizens, there is good governance.

PrajaShakti serves whistleblowers and citizens criticising powerful officials. A security breach here is not just data loss — it puts real people at risk. Security is a first-class concern.

---

## Threat Model

### Who are the attackers?

| Actor                   | Motivation                             | Capability                                |
| ----------------------- | -------------------------------------- | ----------------------------------------- |
| Corrupt officials       | Silence critics, identify complainants | Funded, patient, may have state resources |
| Political operatives    | Suppress issues harmful to their party | Funded, can hire technical talent         |
| Opportunistic attackers | Data theft, account takeover           | Commodity tooling, automated scanners     |
| Disgruntled users       | Vandalism, spam                        | Low sophistication                        |

### What are they after?

- **Identity of complainants** — who filed issues about which official
- **Phone numbers** — India's primary identity token, enables targeted harassment
- **Session tokens** — account takeover to post disinformation or silence accounts
- **Admin access** — to remove issues, ban users, manipulate data
- **Platform availability** — DDoS to silence the platform during critical events

### What we protect

- Phone numbers (PII) — never returned in public API responses, masked in UI
- Session tokens — short-lived access tokens + rotating refresh tokens
- Platform integrity — all user content sanitised, audit trail maintained

---

## Defence in Depth Layers

### Layer 1: Transport

- HTTPS only in production (enforced by HSTS: `max-age=31536000; includeSubDomains; preload`)
- Redis in production uses TLS (`rediss://`)
- PostgreSQL in production requires SSL (`?sslmode=require`)

### Layer 2: Authentication

- **OTP-only login** — no passwords to steal or brute-force
- **JWT access tokens** — 15-minute lifetime, signed with HS256
- **Refresh token rotation** — every `/refresh` call issues a new token and invalidates the old one
- **Token family revocation** — if a stolen+rotated token is reused, the entire session family is revoked and all devices are forced to re-login
- **Blacklist on logout** — access tokens are blacklisted in Redis until their natural expiry

### Layer 3: Rate Limiting (Redis sliding window)

| Endpoint                | Limit                   |
| ----------------------- | ----------------------- |
| OTP send (hourly)       | 5 / phone / hour        |
| OTP send (cooldown)     | 1 / phone / 60s         |
| OTP verify (failures)   | 5 failures → 1h lockout |
| Auth endpoints (per IP) | 10 / min / IP           |
| Global (per IP)         | 200 / min / IP          |
| Issue creation          | 5 / hour / user         |
| Comments                | 30 / hour / user        |
| AI features             | 10 / hour / user        |
| Search                  | 30 / min / user         |

### Layer 4: Input Sanitisation

- All request bodies pass through `sanitiserHook` (global `preValidation`)
- Null bytes stripped
- HTML entities escaped for plain-text fields (via `validator.escape`)
- Rich-text fields sanitised with DOMPurify (allow-list of safe tags only)
- Field whitelisting in `updateProfile` — unknown fields are silently dropped

### Layer 5: SQL Injection Prevention

- All DB queries use parameterised statements (`pg` library, `$1` placeholders)
- Dynamic PATCH query uses an explicit `ALLOWED_PATCH_FIELDS` set
- Table name is never accepted from user input
- ESLint plugin (eslint-plugin-security) flags potential injection patterns

### Layer 6: XSS Prevention

- API responses are always `Content-Type: application/json` (never `text/html`)
- React escapes JSX content by default — `dangerouslySetInnerHTML` is not used for user content
- Multi-line user text uses CSS `white-space: pre-wrap`, not raw `<br>` injection
- User-supplied URLs are validated with `safeUrl()` — `javascript:` and `data:` URIs are rejected
- Helmet sets `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`
- CSP in production disallows inline scripts and restricts sources

### Layer 7: Security Headers (Helmet)

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; ...
X-Permitted-Cross-Domain-Policies: none
```

### Layer 8: Audit Logging

Every security-relevant event is written to `audit_log` with user ID, IP, user-agent, and metadata.

Critical events (`auth.token_reuse_detected`, `security.csrf_attempt`) also emit an immediate console error.

---

## Secret Management

### Development

- Copy `.env.example` to `.env` and fill in values
- `.env` is in `.gitignore` — **never commit it**
- Dev secrets (LocalStack, test JWT) are safe to be weak

### Production

- Use **AWS Secrets Manager** or environment variables set by the deployment platform
- Never commit secrets to version control
- Never log secrets — `redactSensitive()` strips `password`, `otp`, `token`, `secret`, `authorization`, `api_key` from all log output

### Required production secrets

| Variable            | Minimum                         | Notes                            |
| ------------------- | ------------------------------- | -------------------------------- |
| `JWT_SECRET`        | 32+ chars, random               | Generate: `openssl rand -hex 32` |
| `DATABASE_URL`      | Must include `?sslmode=require` |                                  |
| `MSG91_AUTH_KEY`    | Required                        | OTP delivery                     |
| `ANTHROPIC_API_KEY` | Required for AI features        |                                  |

---

## Startup Security Checks

`runSecurityChecks()` runs before the server starts and will `process.exit(1)` in production if:

- `JWT_SECRET` is missing, default, or under 32 chars
- `DATABASE_URL` is missing or lacks SSL
- `OTP_PROVIDER` is set to `console`
- `MSG91_AUTH_KEY` is missing

---

## Incident Response Playbook

### Token compromise suspected

1. Identify affected user(s) from `audit_log` WHERE `event_type = 'auth.token_reuse_detected'`
2. Call `revokeAllUserTokens(redis, userId)` for affected users → forces re-login on all devices
3. Notify user via SMS OTP channel
4. Review `audit_log` for the hour before incident for unusual activity

### Mass account compromise

1. Rotate `JWT_SECRET` → immediately invalidates ALL active sessions (all users re-login)
2. Flush Redis `refresh:*` keys: `redis-cli --scan --pattern 'refresh:*' | xargs redis-cli del`
3. Review `audit_log` for the pattern across all accounts

### Data breach

1. Take API offline (`pm2 stop all` or scale to 0)
2. Preserve logs — do not wipe
3. Notify affected users by SMS
4. File CERT-In report within 6 hours (mandatory under IT Act)
5. Engage legal counsel for user notification obligations

### Denial of Service

1. Cloudflare WAF → enable "Under Attack Mode"
2. Block offending IP ranges at load balancer level
3. Rate limits (Redis) remain effective for authenticated users

---

## Bug Bounty Intent

PrajaShakti intends to run a responsible disclosure program. Until it launches formally:

- **Contact**: security@prajashakti.in
- **Scope**: API, web app, mobile app
- **Out of scope**: Social engineering, physical attacks, third-party services
- **Response SLA**: Acknowledge within 48h, patch critical within 7 days
- **Hall of Fame**: Credited researchers listed at prajashakti.in/security/thanks

Please do not: publicly disclose before we've had a chance to patch, access or modify user data, run automated scanners against production.

---

## Compliance Notes

- **DPDP Act 2023** (India): User data minimisation, purpose limitation, and breach notification obligations apply
- **IT Act 2000, Section 43A**: Reasonable security practices for sensitive personal data
- **RBI guidelines**: Not applicable (no payment processing on-platform; donations via third-party PG)

---

_Last updated: Day 14 — Security Hardening_
_Owner: Platform Engineering Team_
