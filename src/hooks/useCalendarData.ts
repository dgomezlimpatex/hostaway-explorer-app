
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Task {
  id: string;
  property: string;
  address: string;
  startTime: string;
  endTime: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed';
  checkOut: string;
  checkIn: string;
  cleaner?: string;
  backgroundColor?: string;
}

export interface Cleaner {
  id: string;
  name: string;
  avatar?: string;
  isActive: boolean;
}

export const useCalendarData = () => {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'three-day' | 'week'>('day');

  // Fetch tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', currentDate, currentView],
    queryFn: async () => {
      // Simulated data for now - replace with actual API call
      const mockTasks: Task[] = [
        {
          id: '1',
          property: 'Blue Ocean Portonovo Studio 1°D',
          address: 'Turquoise Apartments SL',
          startTime: '11:00',
          endTime: '13:30',
          type: 'checkout-checkin',
          status: 'pending',
          checkOut: '11:00',
          checkIn: '15:00',
          cleaner: 'María García'
        },
        {
          id: '2',
          property: 'Villa Costa del Sol',
          address: 'Av. Marítima 45',
          startTime: '09:00',
          endTime: '12:00',
          type: 'checkout-checkin',
          status: 'in-progress',
          checkOut: '10:00',
          checkIn: '16:00',
          cleaner: 'Ana López'
        },
        {
          id: '3',
          property: 'Apartamento Retiro Premium',
          address: 'Plaza del Retiro 12',
          startTime: '14:00',
          endTime: '17:00',
          type: 'maintenance',
          status: 'pending',
          checkOut: '12:00',
          checkIn: '18:00',
          cleaner: 'Carlos Ruiz'
        },
        {
          id: '4',
          property: 'Casas Coruña CB',
          address: 'MOSTEIRO BRIBES',
          startTime: '16:00',
          endTime: '20:00',
          type: 'checkout-checkin',
          status: 'pending',
          checkOut: '16:00',
          checkIn: '21:00',
          cleaner: 'Thalia Martínez'
        }
      ];
      return mockTasks;
    },
  });

  // Fetch cleaners
  const { data: cleaners = [], isLoading: isLoadingCleaners } = useQuery({
    queryKey: ['cleaners'],
    queryFn: async () => {
      const mockCleaners: Cleaner[] = [
        { id: '1', name: 'María García', isActive: true },
        { id: '2', name: 'Ana López', isActive: true },
        { id: '3', name: 'Carlos Ruiz', isActive: true },
        { id: '4', name: 'Jhoana Quintero', isActive: true },
        { id: '5', name: 'Jaritza', isActive: true },
        { id: '6', name: 'Lali Freire', isActive: true },
        { id: '7', name: 'Katerine Samboni', isActive: true },
        { id: '8', name: 'Thalia Martínez', isActive: true }
      ];
      return mockCleaners;
    },
  });

  // Mutations for task operations
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      // Replace with actual API call
      console.log('Updating task:', taskId, updates);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const assignTaskMutation = useMutation({
    mutationFn: async ({ taskId, cleanerId }: { taskId: string; cleanerId: string }) => {
      // Replace with actual API call
      console.log('Assigning task:', taskId, 'to cleaner:', cleanerId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Navigation functions
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
    setCurrentDate(new Date());
  }, []);

  return {
    // Data
    tasks,
    cleaners,
    currentDate,
    currentView,
    
    // Loading states
    isLoading: isLoadingTasks || isLoadingCleaners,
    
    // Actions
    setCurrentDate,
    setCurrentView,
    navigateDate,
    goToToday,
    updateTask: updateTaskMutation.mutate,
    assignTask: assignTaskMutation.mutate,
    
    // Mutation states
    isUpdatingTask: updateTaskMutation.isPending,
    isAssigningTask: assignTaskMutation.isPending,
  };
};
