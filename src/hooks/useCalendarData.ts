
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
  date: string; // Added date field
}

export interface Cleaner {
  id: string;
  name: string;
  avatar?: string;
  isActive: boolean;
}

// In-memory storage for tasks (simulating a database)
let tasksStorage: Task[] = [
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
    cleaner: 'María García',
    date: new Date().toISOString().split('T')[0] // Today's date
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
    cleaner: 'Ana López',
    date: new Date().toISOString().split('T')[0] // Today's date
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
    cleaner: 'Carlos Ruiz',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Tomorrow
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
    cleaner: 'Thalia Martínez',
    date: new Date().toISOString().split('T')[0] // Today's date
  }
];

export const useCalendarData = () => {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'three-day' | 'week'>('day');

  // Fetch tasks for current date
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['tasks', currentDate, currentView],
    queryFn: async () => {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      // Filter tasks by current date
      const filteredTasks = tasksStorage.filter(task => {
        if (currentView === 'day') {
          return task.date === currentDateStr;
        } else if (currentView === 'three-day') {
          const date1 = new Date(currentDate);
          const date2 = new Date(currentDate);
          const date3 = new Date(currentDate);
          date2.setDate(date2.getDate() + 1);
          date3.setDate(date3.getDate() + 2);
          
          return [
            date1.toISOString().split('T')[0],
            date2.toISOString().split('T')[0],
            date3.toISOString().split('T')[0]
          ].includes(task.date);
        } else { // week view
          const startOfWeek = new Date(currentDate);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day;
          startOfWeek.setDate(diff);
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          
          const taskDate = new Date(task.date);
          return taskDate >= startOfWeek && taskDate <= endOfWeek;
        }
      });
      
      return filteredTasks;
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
      const taskIndex = tasksStorage.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        tasksStorage[taskIndex] = { ...tasksStorage[taskIndex], ...updates };
        console.log('Task updated:', tasksStorage[taskIndex]);
        return tasksStorage[taskIndex];
      }
      throw new Error('Task not found');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const assignTaskMutation = useMutation({
    mutationFn: async ({ taskId, cleanerId }: { taskId: string; cleanerId: string }) => {
      const taskIndex = tasksStorage.findIndex(task => task.id === taskId);
      const cleaner = cleaners.find(c => c.id === cleanerId);
      
      if (taskIndex !== -1 && cleaner) {
        tasksStorage[taskIndex] = { 
          ...tasksStorage[taskIndex], 
          cleaner: cleaner.name 
        };
        console.log('Task assigned:', tasksStorage[taskIndex]);
        return tasksStorage[taskIndex];
      }
      throw new Error('Task or cleaner not found');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<Task, 'id'>) => {
      const newTask: Task = {
        ...taskData,
        id: Date.now().toString(),
        date: taskData.date || currentDate.toISOString().split('T')[0]
      };
      
      tasksStorage.push(newTask);
      console.log('Task created:', newTask);
      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const taskIndex = tasksStorage.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        const deletedTask = tasksStorage.splice(taskIndex, 1)[0];
        console.log('Task deleted:', deletedTask);
        return { success: true, deletedTask };
      }
      throw new Error('Task not found');
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
    createTask: createTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    
    // Mutation states
    isUpdatingTask: updateTaskMutation.isPending,
    isAssigningTask: assignTaskMutation.isPending,
    isCreatingTask: createTaskMutation.isPending,
    isDeletingTask: deleteTaskMutation.isPending,
  };
};
