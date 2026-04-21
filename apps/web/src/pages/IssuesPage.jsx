import { useRef, useEffect, useState, useCallback } from 'react';
import { useInfiniteIssues } from '../hooks/useInfiniteIssues.js';
import { useUrlFilters } from '../hooks/useUrlFilters.js';
import { useSavedSearches } from '../hooks/useSavedSearches.js';
import { supportApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import IssueCard from '../components/IssueCard.jsx';
import IssueSearchBar from '../components/issue/IssueSearchBar.jsx';
import FilterChips from '../components/issue/FilterChips.jsx';
import SortDropdown from '../components/issue/SortDropdown.jsx';
import FilterPanel from '../components/issue/FilterPanel.jsx';
import FilterSummaryBar from '../components/issue/FilterSummaryBar.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';

// ── Skeleton grid ─────────────────────────────────────────────────────────────

function SkeletonGrid({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear, onCreateIssue }) {
  if (hasFilters) {
    return (
      <div style={{ width: '100%', textAlign: 'center', padding: '48px 16px' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔍</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          No issues match your filters
        </h3>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
          Try removing some filters or searching a wider area.
        </p>
        <button
          onClick={onClear}
          style={{
            padding: '10px 22px',
            background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', textAlign: 'center', padding: '48px 16px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>📢</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
        No issues yet
      </h3>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.6 }}>
        Be the first to raise a civic issue in your area.
      </p>
      <button
        onClick={onCreateIssue}
        style={{
          padding: '10px 22px',
          background: 'linear-gradient(135deg, #DC143C, #c01234)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        🚩 Report the first issue
      </button>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div style={{ width: '100%', textAlign: 'center', padding: '48px 16px' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
        Couldn't load issues
      </h3>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
        Check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        style={{
          padding: '10px 22px',
          background: '#0D4F4F',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IssuesPage({ onCreateIssue, onOpenIssue }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { filters, updateFilters, clearFilters, activeCount } = useUrlFilters();
  const { saved: savedSearches, saveSearch } = useSavedSearches();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Supported issues: optimistic local set persisted in localStorage
  const [supportedIds, setSupportedIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('ps_supported_ids') || '[]'));
    } catch {
      return new Set();
    }
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteIssues(filters);

  // Flatten all pages
  const issues = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.pagination?.total ?? 0;
  const hasFilters = activeCount > 0;

  // Infinite scroll sentinel
  const sentinelRef = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    const el = sentinelRef.current;
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSupport = useCallback(
    async (issueId) => {
      if (!user) {
        showToast('Please log in to support issues', 'error');
        return;
      }
      const alreadySupported = supportedIds.has(issueId);

      // Optimistic update
      setSupportedIds((prev) => {
        const next = new Set(prev);
        alreadySupported ? next.delete(issueId) : next.add(issueId);
        try {
          localStorage.setItem('ps_supported_ids', JSON.stringify([...next]));
        } catch {}
        return next;
      });

      try {
        if (alreadySupported) {
          await supportApi.unsupport(issueId);
        } else {
          await supportApi.support(issueId);
        }
      } catch {
        // Revert
        setSupportedIds((prev) => {
          const next = new Set(prev);
          alreadySupported ? next.add(issueId) : next.delete(issueId);
          try {
            localStorage.setItem('ps_supported_ids', JSON.stringify([...next]));
          } catch {}
          return next;
        });
        showToast("Couldn't update support. Please try again.", 'error');
      }
    },
    [user, supportedIds, showToast],
  );

  function handleCardClick(issueId) {
    onOpenIssue?.(issueId);
  }

  // Load a saved search: replace all current filters
  function handleLoadSavedSearch(savedFilters) {
    clearFilters();
    updateFilters(savedFilters, { pushHistory: true });
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      {/* ── Sticky filter bar ─────────────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 60,
          zIndex: 50,
          background: 'rgba(244,245,240,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          padding: '10px 16px',
        }}
      >
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {/* Search + sort row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <IssueSearchBar
                value={filters.search}
                onChange={(q) => updateFilters({ search: q })}
                savedSearches={savedSearches}
                onLoadSavedSearch={handleLoadSavedSearch}
              />
            </div>
            <SortDropdown value={filters.sort} onChange={(s) => updateFilters({ sort: s })} />
          </div>

          {/* Filter chips */}
          <FilterChips filters={filters} onUpdate={updateFilters} />

          {/* More filters toggle + issue count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                color: showAdvanced ? '#0D4F4F' : '#888',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '2px 0',
              }}
            >
              {showAdvanced ? '▲ Less filters' : '▼ More filters'}
              {(filters.state ||
                filters.district ||
                filters.dateRange !== 'all' ||
                filters.minSupport > 0 ||
                filters.hasPhotos ||
                filters.verifiedOnly ||
                filters.lat != null) && (
                <span
                  style={{
                    marginLeft: 6,
                    background: '#14897A',
                    color: '#fff',
                    borderRadius: 99,
                    fontSize: 10,
                    padding: '1px 6px',
                    fontWeight: 700,
                  }}
                >
                  active
                </span>
              )}
            </button>
            {!hasFilters && (
              <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>
                {isLoading ? '...' : `${total.toLocaleString('en-IN')} issues`}
              </span>
            )}
          </div>

          {/* Advanced filter panel */}
          {showAdvanced && (
            <div style={{ marginTop: 8 }}>
              <FilterPanel filters={filters} onUpdate={updateFilters} onClear={clearFilters} />
            </div>
          )}

          {/* Active filter summary bar (replaces old ActiveFilterBar) */}
          <FilterSummaryBar
            filters={filters}
            onUpdate={updateFilters}
            onClear={clearFilters}
            total={total}
            isLoading={isLoading}
            onSaveSearch={saveSearch}
          />
        </div>
      </div>

      {/* ── Results grid ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 16px 100px' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {isLoading ? (
            <SkeletonGrid count={6} />
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : issues.length === 0 ? (
            <EmptyState
              hasFilters={hasFilters}
              onClear={clearFilters}
              onCreateIssue={onCreateIssue}
            />
          ) : (
            issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                supported={supportedIds.has(issue.id)}
                onSupport={handleSupport}
                onCardClick={handleCardClick}
                searchQuery={filters.search}
              />
            ))
          )}

          {/* Infinite scroll next-page skeletons */}
          {isFetchingNextPage && <SkeletonGrid count={3} />}
        </div>

        {/* Sentinel for intersection observer */}
        <div ref={sentinelRef} style={{ height: 1 }} />

        {/* End of results */}
        {!hasNextPage && issues.length > 0 && !isLoading && (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0',
              fontSize: 13,
              color: '#aaa',
              fontWeight: 500,
            }}
          >
            — {total.toLocaleString('en-IN')} issues total —
          </div>
        )}
      </div>
    </div>
  );
}
