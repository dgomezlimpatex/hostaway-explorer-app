
import { useState, useCallback } from 'react';
import { ViewType } from '@/types/calendar';

export const useCalendarNavigation = () => {
  // Inicializar con la fecha actual de Madrid (UTC+2)
  const getMadridDate = () => {
    const now = new Date();
    // Crear fecha en zona horaria de Madrid
    const madridTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
    console.log('useCalendarNavigation - Madrid date:', madridTime.toISOString().split('T')[0]);
    return madridTime;
  };

  const [currentDate, setCurrentDate] = useState(getMadridDate());
  const [currentView, setCurrentView] = useState<ViewType>('day');

  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const days = currentView === 'day' ? 1 : currentView === 'three-day' ? 3 : 7;
    
    if (direction === 'prev') {
      newDate.setDate(currentDate.getDate() - days);
    } else {
      newDate.setDate(currentDate.getDate() + days);
    }
    console.log('useCalendarNavigation - navigating to:', newDate.toISOString().split('T')[0]);
    setCurrentDate(newDate);
  }, [currentDate, currentView]);

  const goToToday = useCallback(() => {
    const today = getMadridDate();
    console.log('useCalendarNavigation - going to today:', today.toISOString().split('T')[0]);
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
