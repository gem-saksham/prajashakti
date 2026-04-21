/**
 * useInfiniteIssues — manual pagination for the feed.
 *
 * Mirrors the shape of the web's react-query hook so the FeedScreen can swap
 * one for the other: returns `{ issues, total, isLoading, isRefreshing, isError,
 * isFetchingNextPage, hasNextPage, refetch, fetchNextPage }`.
 *
 * Strategy:
 *  - Refetch from page 1 whenever serialized api-params change.
 *  - Dedupe in-flight pagination; ignore stale responses (lastReqRef).
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { issueApi } from '../utils/api';
import { toApiParams } from './useIssueFilters';
import { cacheIssueList, readCachedIssueList } from '../services/issueCache';

const PAGE_SIZE = 20;

export function useInfiniteIssues(filters) {
  const apiParams = useMemo(() => toApiParams(filters), [filters]);
  // Stable key — reorders don't trigger a refetch
  const key = useMemo(() => JSON.stringify(apiParams), [apiParams]);

  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isError, setIsError] = useState(false);

  // Tracks the most recent request so stale responses don't overwrite newer ones.
  const lastReqRef = useRef(0);

  const fetchPage = useCallback(
    async (targetPage, { replace }) => {
      const reqId = ++lastReqRef.current;
      try {
        const res = await issueApi.list({
          ...apiParams,
          page: targetPage,
          limit: PAGE_SIZE,
        });
        if (reqId !== lastReqRef.current) return; // stale
        const pageData = res.data ?? [];
        setIssues((prev) => {
          const next = replace ? pageData : [...prev, ...pageData];
          // Only cache the default feed view (no filters) from page 1.
          if (targetPage === 1 && Object.keys(apiParams).length === 0) {
            cacheIssueList(next);
          }
          return next;
        });
        setPage(targetPage);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setTotal(res.pagination?.total ?? pageData.length);
        setIsError(false);
      } catch {
        if (reqId !== lastReqRef.current) return;
        // Network failure on the initial page of the default feed — fall back to cache.
        if (targetPage === 1 && replace && Object.keys(apiParams).length === 0) {
          const cached = await readCachedIssueList();
          if (cached?.length) {
            setIssues(cached);
            setTotal(cached.length);
            setTotalPages(1);
            setIsError(false);
            return;
          }
        }
        setIsError(true);
      }
    },
    [apiParams],
  );

  // Refetch from page 1 when filters change
  useEffect(() => {
    setIsLoading(true);
    fetchPage(1, { replace: true }).finally(() => setIsLoading(false));
  }, [key, fetchPage]);

  const refetch = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchPage(1, { replace: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchPage]);

  const fetchNextPage = useCallback(async () => {
    if (isFetchingNextPage || isLoading || page >= totalPages) return;
    setIsFetchingNextPage(true);
    try {
      await fetchPage(page + 1, { replace: false });
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [isFetchingNextPage, isLoading, page, totalPages, fetchPage]);

  const hasNextPage = page < totalPages;

  return {
    issues,
    total,
    isLoading,
    isRefreshing,
    isFetchingNextPage,
    isError,
    hasNextPage,
    refetch,
    fetchNextPage,
  };
}
