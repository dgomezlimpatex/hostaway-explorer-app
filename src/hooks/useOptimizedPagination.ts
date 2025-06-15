
import { useMemo, useCallback, useState } from 'react';

interface UseOptimizedPaginationProps<T> {
  data: T[];
  pageSize: number;
  initialPage?: number;
}

export const useOptimizedPagination = <T,>({
  data,
  pageSize,
  initialPage = 1
}: UseOptimizedPaginationProps<T>) => {
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Memoizar cálculos de paginación
  const paginationData = useMemo(() => {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    };
  }, [data.length, pageSize, currentPage]);

  // Memoizar datos paginados
  const paginatedData = useMemo(() => {
    return data.slice(paginationData.startIndex, paginationData.endIndex);
  }, [data, paginationData.startIndex, paginationData.endIndex]);

  // Handlers optimizados
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= paginationData.totalPages) {
      setCurrentPage(page);
    }
  }, [paginationData.totalPages]);

  const nextPage = useCallback(() => {
    if (paginationData.hasNext) {
      setCurrentPage(prev => prev + 1);
    }
  }, [paginationData.hasNext]);

  const prevPage = useCallback(() => {
    if (paginationData.hasPrev) {
      setCurrentPage(prev => prev - 1);
    }
  }, [paginationData.hasPrev]);

  const goToFirst = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToLast = useCallback(() => {
    setCurrentPage(paginationData.totalPages);
  }, [paginationData.totalPages]);

  // Reset página cuando cambian los datos
  useMemo(() => {
    if (currentPage > paginationData.totalPages && paginationData.totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, paginationData.totalPages]);

  return {
    currentPage,
    paginatedData,
    totalPages: paginationData.totalPages,
    totalItems: paginationData.totalItems,
    hasNext: paginationData.hasNext,
    hasPrev: paginationData.hasPrev,
    goToPage,
    nextPage,
    prevPage,
    goToFirst,
    goToLast,
    pageInfo: {
      start: paginationData.startIndex + 1,
      end: paginationData.endIndex,
      total: paginationData.totalItems
    }
  };
};
