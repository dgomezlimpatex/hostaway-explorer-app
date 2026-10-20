
import { useState, useCallback } from 'react';
import { ViewType } from '@/types/calendar';
import { getTodayMadrid } from '@/utils/date';
import { parseCalendarUrlState } from '@/components/calendar/utils/calendarUrlState';
import { civilDateToLocalDate } from '@/components/calendar/utils/multiDayCalendar';

// The first render already uses the date and view of the URL, so a reload or
// a link opens the right period without loading today first.
const readInitialUrlState = () => {
  if (typeof window === 'undefined' || !window.location) return parseCalendarUrlState(new URLSearchParams());
  return parseCalendarUrlState(new URLSearchParams(window.location.search));
};

export const useCalendarNavigation = () => {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const { date } = readInitialUrlState();
    return date ? civilDateToLocalDate(date) : getTodayMadrid();
  });
  const [currentView, setCurrentView] = useState<ViewType>(() => readInitialUrlState().view ?? 'day');

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
