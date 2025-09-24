import { useMemo, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';

interface PerformanceConfig {
  enableVirtualization: boolean;
  enableMemoization: boolean;
  enableDebounce: boolean;
  debounceMs: number;
  virtualizationThreshold: number;
}

export const usePerformanceOptimization = (config: Partial<PerformanceConfig> = {}) => {
  const defaultConfig: PerformanceConfig = {
    enableVirtualization: true,
    enableMemoization: true,
    enableDebounce: true,
    debounceMs: 300,
    virtualizationThreshold: 50,
    ...config
  };

  // Performance monitoring
  const performanceRef = useRef({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0
  });

  // Start performance measurement
  const startPerformanceMeasure = useCallback((label: string) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-start`);
    }
    performanceRef.current.lastRenderTime = Date.now();
  }, []);

  // End performance measurement
  const endPerformanceMeasure = useCallback((label: string) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-end`);
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
        const measure = performance.getEntriesByName(label).pop();
        if (measure) {
          const currentTime = measure.duration;
          performanceRef.current.renderCount++;
          performanceRef.current.averageRenderTime = 
            (performanceRef.current.averageRenderTime + currentTime) / performanceRef.current.renderCount;
          
          if (currentTime > 16) { // Alert if render takes longer than 16ms (60fps)
            console.warn(`Slow render detected for ${label}: ${currentTime.toFixed(2)}ms`);
          }
        }
      } catch (e) {
        // Ignore performance API errors
      }
    }
  }, []);

  // Optimized memoization helper
  const optimizedMemo = useCallback(<T>(fn: () => T, deps: React.DependencyList): T => {
    return useMemo(fn, defaultConfig.enableMemoization ? deps : []);
  }, [defaultConfig.enableMemoization]);

  // Optimized callback helper
  const optimizedCallback = useCallback(<T extends (...args: any[]) => any>(
    fn: T, 
    deps: React.DependencyList
  ): T => {
    return useCallback(fn, defaultConfig.enableMemoization ? deps : []);
  }, [defaultConfig.enableMemoization]);

  // Debounced function creator
  const createDebouncedFunction = useCallback(<T extends (...args: any[]) => any>(
    fn: T,
    ms?: number
  ): T => {
    if (!defaultConfig.enableDebounce) return fn;
    return debounce(fn, ms || defaultConfig.debounceMs) as unknown as T;
  }, [defaultConfig.enableDebounce, defaultConfig.debounceMs]);

  // Should use virtualization check
  const shouldUseVirtualization = useCallback((itemCount: number): boolean => {
    return defaultConfig.enableVirtualization && 
           itemCount > defaultConfig.virtualizationThreshold;
  }, [defaultConfig.enableVirtualization, defaultConfig.virtualizationThreshold]);

  // Performance stats
  const getPerformanceStats = useCallback(() => {
    return {
      renderCount: performanceRef.current.renderCount,
      averageRenderTime: performanceRef.current.averageRenderTime,
      lastRenderTime: performanceRef.current.lastRenderTime
    };
  }, []);

  return {
    startPerformanceMeasure,
    endPerformanceMeasure,
    optimizedMemo,
    optimizedCallback,
    createDebouncedFunction,
    shouldUseVirtualization,
    getPerformanceStats,
    config: defaultConfig
  };
};