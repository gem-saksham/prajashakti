# Slow Query Log — PrajaShakti API

Queries that exceeded 100ms in EXPLAIN ANALYZE, with root cause and fix applied.

---

## How to Find Slow Queries

```sql
-- Requires pg_stat_statements extension (enabled in migrations)
SELECT
  left(query, 100) AS query_snippet,
  calls,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(total_exec_time::numeric, 2) AS total_ms
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## Fixed Queries — Day 22

### Q1: Issue List with Status + Category Filter

**Query:**

```sql
SELECT i.id, i.title, i.status, ...
FROM issues i
WHERE i.status = 'active' AND i.category = 'Infrastructure'
ORDER BY i.created_at DESC
LIMIT 20
```

**Problem:** Three separate single-column indexes (`idx_issues_status`, `idx_issues_category`, `idx_issues_created_at`) forced PostgreSQL to bitmap-AND the status and category indexes, then re-sort. Under load with 500+ issues this was ~180ms P95.

**Fix (migration 20260413000020):**

```sql
CREATE INDEX CONCURRENTLY idx_issues_status_cat_created
  ON issues (status, category, created_at DESC)
  WHERE status != 'closed';
```

This is a covering partial index. The `WHERE status != 'closed'` exclusion keeps it small (closed issues are ~5% of active dataset but accumulate over time).

**Expected improvement:** P95 drops from ~180ms → <50ms for filtered list.

---

### Q2: Issue List with District + State Filter

**Query:**

```sql
SELECT i.*
FROM issues i
WHERE i.district = 'Central Delhi' AND i.state = 'Delhi'
  AND i.status != 'closed'
ORDER BY i.created_at DESC
LIMIT 20
```

**Problem:** `idx_issues_district_state` existed but didn't include `created_at`, causing an extra sort step on the filtered results. With 500 issues per district this was ~150ms.

**Fix:**

```sql
CREATE INDEX CONCURRENTLY idx_issues_district_state_created
  ON issues (district, state, status, created_at DESC)
  WHERE status != 'closed';
```

---

### Q3: Support Velocity (24-hour window)

**Query:**

```sql
SELECT date_trunc('hour', created_at) AS hour, COUNT(*) AS cnt
FROM supports
WHERE issue_id = $1
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour ASC
```

**Problem:** `idx_supports_issue` indexed only `issue_id`. The `created_at >= NOW() - 24h` filter required scanning all support rows for the issue. For a viral issue with 10k supports, this was ~300ms.

**Fix:**

```sql
CREATE INDEX CONCURRENTLY idx_supports_issue_created
  ON supports (issue_id, created_at DESC);
```

The composite index allows PostgreSQL to satisfy both the equality predicate and the range predicate in one index scan, avoiding a full-issue-scan.

---

### Q4: Tag Suggestion Keyword Match (known limitation)

**Query:**

```sql
SELECT gc.id, gc.name, ...,
       (SELECT COUNT(*) FROM unnest(gc.keywords) AS kw
        WHERE $1 ILIKE '%' || kw || '%') AS match_count
FROM grievance_categories gc
WHERE is_active = true
  AND (SELECT COUNT(...) > 0)
ORDER BY match_count DESC
LIMIT 10
```

**Problem:** The `ILIKE '%pattern%'` against unnested array elements cannot use any index. For each category, it performs a nested loop over all keywords. With 75 categories × avg 8 keywords = 600 ILIKE comparisons per query. P95 was ~400ms cold.

**Current mitigation:** Redis cache with 10-minute TTL (`suggest:{hash}` key). Subsequent calls for the same input are <1ms.

**Phase 2 fix (Sprint 9):** Replace keyword matching with a pre-trained NLP classifier (BERT fine-tuned on CPGRAMS data). Expected P95 drops to <50ms even cold.

**P2 optimization (optional):** Create a full-text search vector over `keywords` array using `to_tsvector`, enabling GIN index scan. This is a partial fix since `ILIKE` matching differs from full-text matching.

---

## Pending Investigations

| Query                               | Observed P95 | Status                                                    |
| ----------------------------------- | ------------ | --------------------------------------------------------- |
| `GET /officials?q=...` fuzzy search | ~250ms cold  | ✓ pg_trgm GIN index exists; monitor under load            |
| `POST /issues` with geocode         | ~800ms       | ✓ Expected — Nominatim HTTP call; cached after first call |
| `GET /location/jurisdiction`        | ~600ms       | ✓ Expected — External Nominatim call; 24h Redis cache     |
| Reconciliation cron (500 issues)    | ~50ms        | ✓ No action needed                                        |
