import React, { memo, useMemo, useCallback } from 'react';
import { CalendarContainer, CalendarContainerProps } from './CalendarContainer';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';

// Memoized version of CalendarContainer with performance optimizations
export const OptimizedCalendarContainer = memo<CalendarContainerProps>((props) => {
  const { optimizedMemo, startPerformanceMeasure, endPerformanceMeasure } = usePerformanceOptimization();

  React.useEffect(() => {
    startPerformanceMeasure('calendar-container-render');
    return () => endPerformanceMeasure('calendar-container-render');
  });

  // Memoize expensive calculations
  const memoizedData = optimizedMemo(() => {
    return {
      tasksCount: props.tasks.length,
      cleanersCount: props.cleaners.length,
      dateKey: props.currentDate.toISOString().split('T')[0]
    };
  }, [props.tasks.length, props.cleaners.length, props.currentDate]);

  console.log('⚡ OptimizedCalendarContainer render:', memoizedData);

  return <CalendarContainer {...props} />;
});

OptimizedCalendarContainer.displayName = 'OptimizedCalendarContainer';