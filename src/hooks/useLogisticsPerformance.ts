import { useState, useEffect, useCallback, useMemo } from 'react';
import { useVirtualization } from '@/hooks/useVirtualization';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';
import { useIsMobile } from '@/hooks/use-mobile';

interface PerformanceConfig {
  enableVirtualization: boolean;
  itemsPerPage: number;
  lazyLoadThreshold: number;
  cacheSize: number;
}

interface PaginatedData<T> {
  items: T[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const useLogisticsPerformance = <T extends { id: string }>(
  allItems: T[],
  config?: Partial<PerformanceConfig>
) => {
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const performanceConfig: PerformanceConfig = {
    enableVirtualization: isMobile && allItems.length > 50,
    itemsPerPage: isMobile ? 20 : 50,
    lazyLoadThreshold: 100,
    cacheSize: 500,
    ...config
  };

  const {
    optimizedMemo,
    optimizedCallback,
    createDebouncedFunction,
    shouldUseVirtualization,
    startPerformanceMeasure,
    endPerformanceMeasure
  } = usePerformanceOptimization({
    enableVirtualization: performanceConfig.enableVirtualization,
    virtualizationThreshold: performanceConfig.lazyLoadThreshold
  });

  // Debounced search
  const debouncedSetSearchTerm = createDebouncedFunction(setSearchTerm, 300);

  // Filtered and sorted items
  const processedItems = optimizedMemo(() => {
    startPerformanceMeasure('item-processing');
    
    let filtered = allItems;

    // Apply search filter
    if (searchTerm) {
      filtered = allItems.filter(item => 
        Object.values(item).some(value => 
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = (a as any)[sortField];
        const bVal = (b as any)[sortField];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    endPerformanceMeasure('item-processing');
    return filtered;
  }, [allItems, searchTerm, sortField, sortDirection]);

  // Pagination logic
  const paginatedData: PaginatedData<T> = optimizedMemo(() => {
    const totalItems = processedItems.length;
    const totalPages = Math.ceil(totalItems / performanceConfig.itemsPerPage);
    const startIndex = (currentPage - 1) * performanceConfig.itemsPerPage;
    const endIndex = startIndex + performanceConfig.itemsPerPage;
    const items = processedItems.slice(startIndex, endIndex);

    return {
      items,
      totalItems,
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [processedItems, currentPage, performanceConfig.itemsPerPage]);

  // Virtualization setup
  const virtualization = useVirtualization({
    items: paginatedData.items,
    itemHeight: isMobile ? 120 : 60,
    containerHeight: isMobile ? 600 : 400,
    overscan: 5
  });

  // Navigation functions
  const goToPage = optimizedCallback((page: number) => {
    if (page >= 1 && page <= paginatedData.totalPages) {
      setCurrentPage(page);
    }
  }, [paginatedData.totalPages]);

  const nextPage = optimizedCallback(() => {
    if (paginatedData.hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [paginatedData.hasNextPage]);

  const prevPage = optimizedCallback(() => {
    if (paginatedData.hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [paginatedData.hasPrevPage]);

  // Search function
  const handleSearch = optimizedCallback((term: string) => {
    debouncedSetSearchTerm(term);
    setCurrentPage(1); // Reset to first page when searching
  }, [debouncedSetSearchTerm]);

  // Sort function
  const handleSort = optimizedCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  }, [sortField]);

  // Reset filters
  const resetFilters = optimizedCallback(() => {
    setSearchTerm('');
    setSortField('');
    setSortDirection('asc');
    setCurrentPage(1);
  }, []);

  // Check if virtualization should be used
  const shouldUseVirt = shouldUseVirtualization(allItems.length);

  // Performance stats
  const performanceStats = optimizedMemo(() => ({
    totalItems: allItems.length,
    filteredItems: processedItems.length,
    itemsPerPage: performanceConfig.itemsPerPage,
    currentPage,
    totalPages: paginatedData.totalPages,
    isUsingVirtualization: shouldUseVirt,
    searchActive: !!searchTerm,
    sortActive: !!sortField
  }), [
    allItems.length,
    processedItems.length,
    performanceConfig.itemsPerPage,
    currentPage,
    paginatedData.totalPages,
    shouldUseVirt,
    searchTerm,
    sortField
  ]);

  // Effect to reset page when items change significantly
  useEffect(() => {
    if (currentPage > paginatedData.totalPages && paginatedData.totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, paginatedData.totalPages]);

  return {
    // Data
    items: shouldUseVirt ? virtualization.visibleItems : paginatedData.items,
    paginatedData,
    
    // Virtualization (only when enabled)
    virtualization: shouldUseVirt ? virtualization : null,
    
    // Search and filtering
    searchTerm,
    handleSearch,
    
    // Sorting
    sortField,
    sortDirection,
    handleSort,
    
    // Pagination
    currentPage,
    goToPage,
    nextPage,
    prevPage,
    
    // Utilities
    resetFilters,
    performanceStats,
    
    // Configuration
    config: performanceConfig,
    useVirtualization: shouldUseVirt
  };
};