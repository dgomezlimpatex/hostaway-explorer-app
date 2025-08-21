
import { BillingReport } from '@/types/reports';

export const generateBillingReport = (tasks: any[], properties: any[], clients: any[]): BillingReport[] => {
  return tasks.map(task => {
    // Buscar la propiedad asociada a la tarea
    const property = properties.find(p => 
      p.id === task.propiedad_id || 
      p.nombre === task.property ||
      p.codigo === task.property
    );
    
    // Buscar el cliente asociado a la propiedad
    const client = property && property.clienteId ? 
      clients.find(c => c.id === property.clienteId) : 
      null;
    
    // Parse time strings properly
    const startTimeParts = task.startTime ? task.startTime.split(':') : task.start_time ? task.start_time.split(':') : ['0', '0'];
    const endTimeParts = task.endTime ? task.endTime.split(':') : task.end_time ? task.end_time.split(':') : ['0', '0'];
    
    const startMinutes = parseInt(startTimeParts[0]) * 60 + parseInt(startTimeParts[1]);
    const endMinutes = parseInt(endTimeParts[0]) * 60 + parseInt(endTimeParts[1]);
    
    const duration = endMinutes > startMinutes ? endMinutes - startMinutes : 
                    (property?.duracionServicio || task.duracion || 60);
    
    return {
      id: task.id,
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
      property: task.property || property?.nombre || 'Propiedad desconocida',
      client: client?.nombre || task.client || 'Cliente desconocido',
      date: task.date,
      serviceType: task.type,
      type: task.type,
      duration: duration,
      cost: property?.costeServicio || task.coste || 0,
      status: task.status,
      supervisor: client?.supervisor || task.supervisor || 'Sin supervisor',
      sede: property?.sede_id || 'N/A' // Nueva información de sede
    };
  });
};
