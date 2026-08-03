import { useMemo, useState } from 'react';

/**
 * Wireframe-Sales-BizLink.html's `aRenderPager`/`aRenderClientsFiltered`
 * pattern: fixed page size 10, clamp current page into [1, totalPages],
 * reset to page 1 whenever the filtered set identity changes (mirrors
 * `aFiltStatus`'s `aClientPage=1` reset on filter change).
 */
export const PAGINATION_PAGE_SIZE = 10;

export interface UsePaginationResult<T> {
  page: number;
  totalPages: number;
  pageItems: T[];
  setPage: (page: number) => void;
}

/**
 * Bounded client-side pagination over an already-filtered list. Callers
 * must pass a `resetKey` that changes whenever the upstream filter/search
 * changes, so the page resets to 1 — same as the wireframe's `aFiltStatus`.
 */
export function usePagination<T>(items: T[], resetKey: string, pageSize: number = PAGINATION_PAGE_SIZE): UsePaginationResult<T> {
  const [page, setPageState] = useState(1);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setPageState(1);
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return {
    page: currentPage,
    totalPages,
    pageItems,
    setPage: setPageState,
  };
}
