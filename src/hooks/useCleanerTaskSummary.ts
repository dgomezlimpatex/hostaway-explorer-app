import { useMemo } from 'react';
import { Task } from '@/types/calendar';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';

interface UseCleanerTaskSummaryParams {
  tasks: Task[];
  currentDate: Date;
}

export const useCleanerTaskSummary = ({ tasks, currentDate }: UseCleanerTaskSummaryParams) => {
  const { user, userRole } = useAuth();
  const { cleaners } = useCleaners();

  // Get current user's cleaner ID
  const currentCleanerId = useMemo(() => {
    if (userRole !== 'cleaner' || !user?.id || !cleaners) return null;
    const currentCleaner = cleaners.find(cleaner => cleaner.user_id === user.id);
    return currentCleaner?.id || null;
  }, [userRole, user?.id, cleaners]);

  // Filter tasks for current cleaner
  const cleanerTasks = useMemo(() => {
    if (!currentCleanerId) return [];
    return tasks.filter(task => task.cleanerId === currentCleanerId);
  }, [tasks, currentCleanerId]);

  // Calculate today's tasks
  const todayTasks = useMemo(() => {
    const currentDateStr = currentDate.toISOString().split('T')[0];
    return cleanerTasks.filter(task => task.date === currentDateStr);
  }, [cleanerTasks, currentDate]);

  // Calculate tomorrow's tasks
  const tomorrowTasks = useMemo(() => {
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
    return cleanerTasks.filter(task => task.date === tomorrowDateStr);
  }, [cleanerTasks, currentDate]);

  return {
    todayTasks,
    tomorrowTasks,
    totalTasks: cleanerTasks.length,
    currentCleanerId
  };
};