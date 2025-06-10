
import { Task } from '@/types/calendar';

const STORAGE_KEY = 'cleaning_tasks';
const BACKUP_KEY = 'cleaning_tasks_backup';

// Datos por defecto que se cargan solo si no hay datos en localStorage
const defaultTasks: Task[] = [
  {
    id: '1',
    property: 'Blue Ocean Portonovo Studio 1°D',
    address: 'Turquoise Apartments SL',
    startTime: '11:00',
    endTime: '13:30',
    type: 'mantenimiento-airbnb',
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
    type: 'mantenimiento-airbnb',
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
    type: 'limpieza-mantenimiento',
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
    type: 'mantenimiento-cristaleria',
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

// Función para validar si una tarea es válida
const isValidTask = (task: any): task is Task => {
  return task && 
    typeof task.id === 'string' && 
    typeof task.property === 'string' && 
    typeof task.startTime === 'string' && 
    typeof task.endTime === 'string' &&
    typeof task.date === 'string';
};

// Función para validar array de tareas
const validateTasks = (tasks: any[]): Task[] => {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(isValidTask);
};

// Función para cargar tareas desde localStorage con recuperación de backup
const loadTasksFromStorage = (): Task[] => {
  try {
    // Intentar cargar desde storage principal
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const validTasks = validateTasks(parsed);
      
      if (validTasks.length > 0) {
        console.log('Tareas cargadas desde storage principal:', validTasks.length);
        return validTasks;
      }
    }
    
    // Si falla, intentar backup
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      const parsed = JSON.parse(backup);
      const validTasks = validateTasks(parsed);
      
      if (validTasks.length > 0) {
        console.log('Tareas recuperadas desde backup:', validTasks.length);
        // Restaurar al storage principal
        localStorage.setItem(STORAGE_KEY, backup);
        return validTasks;
      }
    }
  } catch (error) {
    console.error('Error loading tasks from localStorage:', error);
    
    // Intentar recuperar backup si hay error
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        const parsed = JSON.parse(backup);
        const validTasks = validateTasks(parsed);
        console.log('Tareas recuperadas desde backup tras error:', validTasks.length);
        return validTasks;
      }
    } catch (backupError) {
      console.error('Error loading backup tasks:', backupError);
    }
  }
  
  console.log('Cargando tareas por defecto');
  return defaultTasks;
};

// Función para guardar tareas en localStorage con backup automático
const saveTasksToStorage = (tasks: Task[]): void => {
  try {
    const validTasks = validateTasks(tasks);
    const dataToSave = JSON.stringify(validTasks);
    
    // Crear backup antes de guardar
    const currentData = localStorage.getItem(STORAGE_KEY);
    if (currentData) {
      localStorage.setItem(BACKUP_KEY, currentData);
    }
    
    // Guardar nuevos datos
    localStorage.setItem(STORAGE_KEY, dataToSave);
    console.log('Tareas guardadas correctamente:', validTasks.length, 'tareas');
    
    // Verificar que se guardó correctamente
    const verification = localStorage.getItem(STORAGE_KEY);
    if (!verification || verification !== dataToSave) {
      throw new Error('Verificación de guardado falló');
    }
    
  } catch (error) {
    console.error('Error saving tasks to localStorage:', error);
    
    // Intentar estrategia de recuperación
    try {
      // Limpiar storage corrupto y reintentar
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validateTasks(tasks)));
      console.log('Guardado exitoso tras limpieza de storage');
    } catch (retryError) {
      console.error('Error crítico al guardar tareas:', retryError);
      alert('Error crítico: No se pudieron guardar las tareas. Los cambios se pueden perder.');
    }
  }
};

// Cargar tareas al inicializar
let tasksStorage: Task[] = loadTasksFromStorage();

// Crear backup automático cada 30 segundos
setInterval(() => {
  try {
    const currentData = localStorage.getItem(STORAGE_KEY);
    if (currentData && tasksStorage.length > 0) {
      localStorage.setItem(BACKUP_KEY, currentData);
    }
  } catch (error) {
    console.error('Error en backup automático:', error);
  }
}, 30000);

export const taskStorageService = {
  getTasks: () => {
    // Verificar integridad antes de devolver
    const validTasks = validateTasks(tasksStorage);
    if (validTasks.length !== tasksStorage.length) {
      console.warn('Tareas corruptas detectadas, limpiando...');
      tasksStorage = validTasks;
      saveTasksToStorage(tasksStorage);
    }
    return [...tasksStorage];
  },
  
  createTask: (taskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      date: taskData.date || new Date().toISOString().split('T')[0]
    };
    
    if (!isValidTask(newTask)) {
      throw new Error('Datos de tarea inválidos');
    }
    
    tasksStorage.push(newTask);
    saveTasksToStorage(tasksStorage);
    console.log('Task created:', newTask);
    return newTask;
  },

  updateTask: (taskId: string, updates: Partial<Task>) => {
    const taskIndex = tasksStorage.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      const updatedTask = { ...tasksStorage[taskIndex], ...updates };
      
      if (!isValidTask(updatedTask)) {
        throw new Error('Datos de actualización inválidos');
      }
      
      tasksStorage[taskIndex] = updatedTask;
      saveTasksToStorage(tasksStorage);
      console.log('Task updated:', tasksStorage[taskIndex]);
      return tasksStorage[taskIndex];
    }
    throw new Error('Task not found');
  },

  deleteTask: (taskId: string) => {
    const taskIndex = tasksStorage.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      const deletedTask = tasksStorage.splice(taskIndex, 1)[0];
      saveTasksToStorage(tasksStorage);
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
      saveTasksToStorage(tasksStorage);
      console.log('Task assigned:', tasksStorage[taskIndex]);
      return tasksStorage[taskIndex];
    }
    throw new Error('Task not found');
  },

  // Función para exportar datos (útil para backup manual)
  exportTasks: () => {
    return JSON.stringify(tasksStorage, null, 2);
  },

  // Función para importar datos
  importTasks: (tasksJson: string) => {
    try {
      const imported = JSON.parse(tasksJson);
      const validTasks = validateTasks(imported);
      tasksStorage = validTasks;
      saveTasksToStorage(tasksStorage);
      console.log('Tasks imported successfully:', validTasks.length);
      return validTasks;
    } catch (error) {
      console.error('Error importing tasks:', error);
      throw new Error('Formato de importación inválido');
    }
  },

  // Función para recuperar desde backup manualmente
  restoreFromBackup: () => {
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        const parsed = JSON.parse(backup);
        const validTasks = validateTasks(parsed);
        tasksStorage = validTasks;
        saveTasksToStorage(tasksStorage);
        console.log('Tasks restored from backup:', validTasks.length);
        return validTasks;
      }
      throw new Error('No backup available');
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw error;
    }
  },

  // Función para resetear a datos por defecto (útil para desarrollo)
  resetToDefaults: () => {
    tasksStorage = [...defaultTasks];
    saveTasksToStorage(tasksStorage);
    console.log('Tasks reset to defaults');
    return tasksStorage;
  },

  // Función para limpiar completamente el almacenamiento
  clearAll: () => {
    tasksStorage = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_KEY);
    console.log('All tasks cleared');
    return [];
  },

  // Función para verificar la salud del storage
  checkStorageHealth: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const backup = localStorage.getItem(BACKUP_KEY);
      
      return {
        hasMainStorage: !!stored,
        hasBackup: !!backup,
        mainStorageValid: stored ? validateTasks(JSON.parse(stored)).length > 0 : false,
        backupValid: backup ? validateTasks(JSON.parse(backup)).length > 0 : false,
        currentTasksCount: tasksStorage.length
      };
    } catch (error) {
      return {
        hasMainStorage: false,
        hasBackup: false,
        mainStorageValid: false,
        backupValid: false,
        currentTasksCount: tasksStorage.length,
        error: error.message
      };
    }
  }
};
