
import { RecurringTask } from '@/types/recurring';
import { Task } from '@/types/calendar';
import { taskStorageService } from './taskStorage';

const STORAGE_KEY = 'recurring_tasks';

// Función para cargar tareas recurrentes desde localStorage
const loadRecurringTasksFromStorage = (): RecurringTask[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading recurring tasks from localStorage:', error);
  }
  return [];
};

// Función para guardar tareas recurrentes en localStorage
const saveRecurringTasksToStorage = (tasks: RecurringTask[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    console.log('Recurring tasks saved to localStorage:', tasks.length, 'tasks');
  } catch (error) {
    console.error('Error saving recurring tasks to localStorage:', error);
  }
};

// Cargar tareas recurrentes al inicializar
let recurringTasksStorage: RecurringTask[] = loadRecurringTasksFromStorage();

// Función para calcular la próxima fecha de ejecución
const calculateNextExecution = (task: RecurringTask, fromDate?: Date): string => {
  const baseDate = fromDate || new Date(task.lastExecution || task.startDate);
  const nextDate = new Date(baseDate);

  switch (task.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + task.interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (task.interval * 7));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + task.interval);
      if (task.dayOfMonth) {
        nextDate.setDate(task.dayOfMonth);
      }
      break;
  }

  return nextDate.toISOString().split('T')[0];
};

// Función para generar una tarea normal a partir de una recurrente
const generateTaskFromRecurring = (recurringTask: RecurringTask, date: string): Omit<Task, 'id'> => {
  return {
    property: `${recurringTask.name} (Recurrente)`,
    address: '', // Se completará con datos de la propiedad si está vinculada
    startTime: recurringTask.startTime,
    endTime: recurringTask.endTime,
    type: recurringTask.type,
    status: 'pending' as const,
    checkOut: recurringTask.checkOut,
    checkIn: recurringTask.checkIn,
    cleaner: recurringTask.cleaner,
    date: date,
    clienteId: recurringTask.clienteId,
    propiedadId: recurringTask.propiedadId,
    duracion: recurringTask.duracion,
    coste: recurringTask.coste,
    metodoPago: recurringTask.metodoPago,
    supervisor: recurringTask.supervisor,
  };
};

export const recurringTaskStorage = {
  getAll: () => [...recurringTasksStorage],
  
  getById: (id: string) => {
    return recurringTasksStorage.find(task => task.id === id);
  },

  create: (taskData: Omit<RecurringTask, 'id' | 'createdAt' | 'nextExecution'>) => {
    const newTask: RecurringTask = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      nextExecution: calculateNextExecution({
        ...taskData,
        id: '',
        createdAt: '',
        nextExecution: ''
      } as RecurringTask, new Date(taskData.startDate))
    };
    
    recurringTasksStorage.push(newTask);
    saveRecurringTasksToStorage(recurringTasksStorage);
    console.log('Recurring task created:', newTask);
    return newTask;
  },

  update: (id: string, updates: Partial<RecurringTask>) => {
    const taskIndex = recurringTasksStorage.findIndex(task => task.id === id);
    if (taskIndex !== -1) {
      const updatedTask = { ...recurringTasksStorage[taskIndex], ...updates };
      
      // Recalcular próxima ejecución si se cambian parámetros de frecuencia
      if (updates.frequency || updates.interval || updates.startDate) {
        updatedTask.nextExecution = calculateNextExecution(updatedTask);
      }
      
      recurringTasksStorage[taskIndex] = updatedTask;
      saveRecurringTasksToStorage(recurringTasksStorage);
      console.log('Recurring task updated:', updatedTask);
      return updatedTask;
    }
    throw new Error('Recurring task not found');
  },

  delete: (id: string) => {
    const taskIndex = recurringTasksStorage.findIndex(task => task.id === id);
    if (taskIndex !== -1) {
      const deletedTask = recurringTasksStorage.splice(taskIndex, 1)[0];
      saveRecurringTasksToStorage(recurringTasksStorage);
      console.log('Recurring task deleted:', deletedTask);
      return { success: true, deletedTask };
    }
    throw new Error('Recurring task not found');
  },

  // Función para procesar tareas recurrentes y generar tareas normales
  processRecurringTasks: () => {
    const today = new Date().toISOString().split('T')[0];
    const generatedTasks: Task[] = [];

    recurringTasksStorage.forEach(recurringTask => {
      if (!recurringTask.isActive) return;
      
      // Verificar si necesita generar una tarea hoy
      if (recurringTask.nextExecution <= today) {
        // Verificar si ya pasó la fecha de fin
        if (recurringTask.endDate && recurringTask.nextExecution > recurringTask.endDate) {
          // Desactivar la tarea recurrente
          recurringTask.isActive = false;
          return;
        }

        // Generar la tarea
        const taskData = generateTaskFromRecurring(recurringTask, recurringTask.nextExecution);
        const newTask = taskStorageService.createTask(taskData);
        generatedTasks.push(newTask);

        // Actualizar la tarea recurrente
        recurringTask.lastExecution = recurringTask.nextExecution;
        recurringTask.nextExecution = calculateNextExecution(recurringTask);
      }
    });

    // Guardar cambios en las tareas recurrentes
    saveRecurringTasksToStorage(recurringTasksStorage);
    
    console.log('Generated tasks from recurring:', generatedTasks.length);
    return generatedTasks;
  },

  // Función para obtener tareas que se ejecutarán en los próximos días
  getUpcomingExecutions: (days: number = 7) => {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    return recurringTasksStorage
      .filter(task => task.isActive)
      .filter(task => {
        const execDate = new Date(task.nextExecution);
        return execDate >= today && execDate <= futureDate;
      })
      .sort((a, b) => new Date(a.nextExecution).getTime() - new Date(b.nextExecution).getTime());
  }
};
