
import { TaskReport } from '@/types/reports';

export const generateTaskReport = (tasks: any[], properties: any[], clients: any[]): TaskReport[] => {
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
    
    // Determinar el método de pago desde el cliente o la tarea
    const paymentMethod = client?.metodoPago || task.metodo_pago || 'No especificado';
    
    // Mapear método de pago a español
    const paymentMethodSpanish = {
      'transferencia': 'Transferencia',
      'efectivo': 'Efectivo',
      'bizum': 'Bizum'
    }[paymentMethod] || paymentMethod;

    return {
      id: task.id,
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
      property: task.property || property?.nombre || 'Propiedad desconocida',
      address: task.address || property?.direccion || 'Dirección no disponible',
      date: task.date,
      startTime: task.startTime || task.start_time || '00:00',
      endTime: task.endTime || task.end_time || '00:00',
      type: task.type,
      status: task.status,
      cleaner: task.cleaner || 'Sin asignar',
      client: client?.nombre || task.client || 'Cliente desconocido',
      
      // Campos adicionales para exportación CSV
      serviceDate: task.date,
      supervisor: client?.supervisor || task.supervisor || 'Sin supervisor',
      serviceType: task.type,
      taskStatus: task.status === 'completed' ? 'Completada' :
                 task.status === 'in-progress' ? 'En Progreso' : 'Pendiente',
      totalCost: property?.costeServicio || task.coste || 0,
      workTeam: task.cleaner || 'Sin asignar',
      paymentMethod: paymentMethodSpanish,
      incidents: task.incidents || 'Ninguna'
    };
  });
};
