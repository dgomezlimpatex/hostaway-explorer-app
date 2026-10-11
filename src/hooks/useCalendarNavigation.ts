
import { useState, useCallback } from 'react';
import { ViewType } from '@/types/calendar';
import { getTodayMadrid, formatMadridDate } from '@/utils/date';

export const useCalendarNavigation = () => {
  const [currentDate, setCurrentDate] = useState<Date>(() => getTodayMadrid());
  const [currentView, setCurrentView] = useState<ViewType>('day');

  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const days = currentView === 'day' ? 1 : currentView === 'three-day' ? 3 : 7;

    if (direction === 'prev') {
      newDate.setDate(currentDate.getDate() - days);
    } else {
      newDate.setDate(currentDate.getDate() + days);
    }
    setCurrentDate(newDate);
  }, [currentDate, currentView]);

  const goToToday = useCallback(() => {
    const today = getTodayMadrid();
    setCurrentDate(today);
  }, []);

  return {
    currentDate,
    currentView,
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday
  };
};
