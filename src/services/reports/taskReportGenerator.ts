
import { TaskReport } from '@/types/reports';

export const generateTaskReport = (tasks: any[], properties: any[], clients: any[]): TaskReport[] => {
  return tasks.map(task => {
    const property = properties.find(p => p.nombre === task.property);
    const client = property ? clients.find(c => c.id === property.clienteId) : null;
    
    return {
      id: task.id,
      property: task.property,
      address: task.address,
      date: task.date,
      startTime: task.startTime,
      endTime: task.endTime,
      type: task.type,
      status: task.status,
      cleaner: task.cleaner || 'Sin asignar',
      client: client?.nombre || 'Cliente desconocido'
    };
  });
};
