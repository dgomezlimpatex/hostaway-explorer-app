
import { BillingReport } from '@/types/reports';

export const generateBillingReport = (tasks: any[], properties: any[], clients: any[]): BillingReport[] => {
  return tasks.map(task => {
    const property = properties.find(p => p.nombre === task.property);
    const client = property ? clients.find(c => c.id === property.clienteId) : null;
    
    // Parse time strings properly
    const startTimeParts = task.startTime.split(':');
    const endTimeParts = task.endTime.split(':');
    
    const startMinutes = parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
    const endMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);
    
    const duration = endMinutes - startMinutes;
    
    return {
      id: task.id,
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
      property: task.property,
      client: client?.nombre || 'Cliente desconocido',
      date: task.date,
      serviceType: task.type,
      type: task.type,
      duration: duration > 0 ? duration : 0,
      cost: property?.costeServicio || 0,
      status: task.status
    };
  });
};
