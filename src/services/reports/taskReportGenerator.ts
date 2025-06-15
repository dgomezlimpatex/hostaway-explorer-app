
import { TaskReport } from '@/types/reports';

export const generateTaskReport = (tasks: any[], properties: any[], clients: any[]): TaskReport[] => {
  return tasks.map(task => {
    const property = properties.find(p => p.nombre === task.property);
    const client = property ? clients.find(c => c.id === property.clienteId) : null;
    
    return {
      id: task.id,
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
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
