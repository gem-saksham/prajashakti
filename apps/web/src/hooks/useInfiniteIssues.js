import { useInfiniteQuery } from '@tanstack/react-query';
import { issueApi } from '../utils/api.js';
import { toApiParams } from './useUrlFilters.js';

export function useInfiniteIssues(filters) {
  const apiParams = toApiParams(filters);

  return useInfiniteQuery({
    queryKey: ['issues', apiParams],
    queryFn: ({ pageParam }) => issueApi.list({ ...apiParams, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    staleTime: 60 * 1000,
  });
}
