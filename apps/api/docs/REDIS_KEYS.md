# Redis Key Space — PrajaShakti API

All Redis keys used by the API, grouped by domain.
Redis DB 0 = production / DB 1 = test (NODE_ENV=test).

---

## Memory Policy

```
maxmemory-policy allkeys-lru
```

All keys are eligible for LRU eviction. Keys with explicit TTL expire first;
hot counters and supporters sets will be kept longest by access frequency.

Recommended `maxmemory`: 512 MB for a 500-issue, 10k-support dataset.

---

## Key Catalogue

### Authentication & Session

| Key Pattern                 | TTL    | Type             | Description                      |
| --------------------------- | ------ | ---------------- | -------------------------------- |
| `otp:{phone}`               | 5 min  | String           | OTP value for phone verification |
| `otp:cooldown:{phone}`      | 1 min  | String           | Cooldown flag after OTP send     |
| `otp:attempts:{phone}`      | 10 min | String (counter) | Failed OTP attempt count         |
| `refresh:{userId}:{family}` | 7 days | String           | Refresh token (hashed)           |

### User Cache

| Key Pattern     | TTL   | Type        | Description                |
| --------------- | ----- | ----------- | -------------------------- |
| `user:{userId}` | 5 min | JSON String | Cached user profile object |

### Issue Counters (Support System)

| Key Pattern                  | TTL          | Type       | Description                                            |
| ---------------------------- | ------------ | ---------- | ------------------------------------------------------ |
| `issue:count:{issueId}`      | LRU (no TTL) | String     | Hot supporter count — mirrors `issues.supporter_count` |
| `issue:supporters:{issueId}` | LRU (no TTL) | Sorted Set | Member=userId, Score=timestamp of support              |

`issue:count` is the read fast-path. If missing, falls back to DB and backfills.
`issue:supporters` is used by `hasUserSupported()` zscore check.

**Reconciliation**: `reconcileCounters()` runs every 10 minutes (cron) and corrects any drift between Redis and PostgreSQL. If Redis is ahead of DB, it's corrected to the DB value (PostgreSQL is source of truth).

### Issue Lists (API Cache)

| Key Pattern                           | TTL    | Type        | Description                      |
| ------------------------------------- | ------ | ----------- | -------------------------------- |
| `issues:list:{sha256_of_filters}`     | 60 sec | JSON String | Paginated issue list results     |
| `issue:stats:{issueId}`               | 60 sec | JSON String | Aggregate stats for single issue |
| `supporters:{issueId}:{page}:{limit}` | 2 min  | JSON String | Paginated supporters list        |

### Tag Suggestions

| Key Pattern                | TTL    | Type        | Description                                                        |
| -------------------------- | ------ | ----------- | ------------------------------------------------------------------ |
| `suggest:{12-char-sha256}` | 10 min | JSON String | Cached autoSuggest result keyed by title+description+location hash |

### Location

| Key Pattern                | TTL  | Type        | Description                                     |
| -------------------------- | ---- | ----------- | ----------------------------------------------- |
| `states:all`               | 24 h | JSON String | All states list                                 |
| `districts:{stateCode}`    | 24 h | JSON String | Districts for a state                           |
| `juri:{lat3dp}:{lng3dp}`   | 24 h | JSON String | Jurisdiction lookup (Nominatim + DB enrichment) |
| `depts:{district}:{state}` | 1 h  | JSON String | Responsible departments for a location          |

### Rate Limiting

| Key Pattern                 | TTL        | Type             | Description                                                             |
| --------------------------- | ---------- | ---------------- | ----------------------------------------------------------------------- |
| `rate:support:{userId}`     | 60 sec     | String (counter) | Support rate limit: 60 supports/min per user                            |
| `fastify-rate-limit-{ip}-*` | per window | String           | @fastify/rate-limit in-memory counters (not stored in Redis by default) |

---

## Key Size Estimates

| Domain                | Keys per Issue            | Estimated Size                    |
| --------------------- | ------------------------- | --------------------------------- |
| Issue counter         | 1                         | ~50 bytes                         |
| Supporters sorted set | 1                         | ~50 bytes + 40 bytes × supporters |
| List cache            | ~10 (pagination variants) | ~5 KB each                        |
| Tag suggestion cache  | 1–10 per unique input     | ~2 KB each                        |
| Location cache        | 1 per unique lat/lng pair | ~500 bytes                        |

For 500 issues with avg 20 supporters each:

- `issue:count:*` = 500 × 50B = 25 KB
- `issue:supporters:*` = 500 × (50B + 40B × 20) = 425 KB
- Total estimated footprint: ~10–50 MB (well within 512 MB budget)

---

## Monitoring

```bash
# Current memory usage
redis-cli INFO memory | grep used_memory_human

# Largest keys (top 25)
redis-cli --bigkeys

# Key count by pattern
redis-cli KEYS "issue:count:*" | wc -l
redis-cli KEYS "issue:supporters:*" | wc -l
redis-cli KEYS "suggest:*" | wc -l

# Check for stale reconciliation
redis-cli KEYS "issue:count:*" | xargs -I {} redis-cli GET {}
```
