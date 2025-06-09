
import { Task } from '@/types/calendar';

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
    date: new Date().toISOString().split('T')[0],
    duracion: 150,
    coste: 45.00,
    metodoPago: 'transferencia',
    supervisor: 'Ana López'
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
    date: new Date().toISOString().split('T')[0],
    duracion: 180,
    coste: 60.00,
    metodoPago: 'efectivo',
    supervisor: 'Carlos Ruiz'
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
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    duracion: 180,
    coste: 75.00,
    metodoPago: 'bizum',
    supervisor: 'María García'
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
    date: new Date().toISOString().split('T')[0],
    duracion: 240,
    coste: 80.00,
    metodoPago: 'transferencia',
    supervisor: 'Ana López'
  }
];

export const taskStorageService = {
  getTasks: () => [...tasksStorage],
  
  createTask: (taskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      date: taskData.date || new Date().toISOString().split('T')[0]
    };
    tasksStorage.push(newTask);
    console.log('Task created:', newTask);
    return newTask;
  },

  updateTask: (taskId: string, updates: Partial<Task>) => {
    const taskIndex = tasksStorage.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      tasksStorage[taskIndex] = { ...tasksStorage[taskIndex], ...updates };
      console.log('Task updated:', tasksStorage[taskIndex]);
      return tasksStorage[taskIndex];
    }
    throw new Error('Task not found');
  },

  deleteTask: (taskId: string) => {
    const taskIndex = tasksStorage.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      const deletedTask = tasksStorage.splice(taskIndex, 1)[0];
      console.log('Task deleted:', deletedTask);
      return { success: true, deletedTask };
    }
    throw new Error('Task not found');
  },

  assignTask: (taskId: string, cleanerName: string) => {
    const taskIndex = tasksStorage.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      tasksStorage[taskIndex] = { 
        ...tasksStorage[taskIndex], 
        cleaner: cleanerName 
      };
      console.log('Task assigned:', tasksStorage[taskIndex]);
      return tasksStorage[taskIndex];
    }
    throw new Error('Task not found');
  }
};
