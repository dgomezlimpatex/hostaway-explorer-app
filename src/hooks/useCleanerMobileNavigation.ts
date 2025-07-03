import { useState, useCallback } from 'react';

export const useCleanerMobileNavigation = (initialDate: Date = new Date()) => {
  const [currentDate, setCurrentDate] = useState(initialDate);

  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 1);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    });
  }, []);

  const setDate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  return {
    currentDate,
    navigateDate,
    setDate
  };
};