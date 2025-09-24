import { useCallback, useRef } from 'react';
import { debounce } from 'lodash';

export const useOptimizedNavigation = (originalNavigateDate: (direction: 'prev' | 'next') => void) => {
  const isNavigatingRef = useRef(false);
  
  // Debounced navigation para evitar múltiples llamadas rápidas
  const debouncedNavigate = useCallback(
    debounce((direction: 'prev' | 'next') => {
      if (isNavigatingRef.current) return;
      
      isNavigatingRef.current = true;
      console.log('⚡ Optimized navigation:', direction);
      
      originalNavigateDate(direction);
      
      // Reset flag after navigation
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 300);
    }, 100),
    [originalNavigateDate]
  );

  // Cancel any pending debounced calls on unmount
  const cancelNavigation = useCallback(() => {
    debouncedNavigate.cancel();
  }, [debouncedNavigate]);

  return {
    navigateDate: debouncedNavigate,
    cancelNavigation,
    isNavigating: () => isNavigatingRef.current
  };
};