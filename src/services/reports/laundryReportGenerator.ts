
import { LaundryReport } from '@/types/reports';

export const generateLaundryReport = (tasks: any[], properties: any[], clients: any[]): LaundryReport[] => {
  return tasks
    .filter(task => task.type && (
      task.type.toLowerCase().includes('limpieza') || 
      task.type.toLowerCase().includes('check') ||
      task.type.toLowerCase().includes('mantenimiento')
    ))
    .map(task => {
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

      // Calcular totales de textiles
      const textiles = {
        sabanas: property?.numeroSabanas || 0,
        toallasGrandes: property?.numeroToallasGrandes || 0,
        toallasPequenas: property?.numeroTotallasPequenas || 0,
        alfombrines: property?.numeroAlfombrines || 0,
        fundasAlmohada: property?.numeroFundasAlmohada || 0
      };

      const totalItems = Object.values(textiles).reduce((sum, count) => sum + count, 0);

      return {
        // Campos base de TaskReport
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
        paymentMethod: client?.metodoPago || task.metodo_pago || 'No especificado',
        incidents: task.incidents || 'Ninguna',

        // Campos específicos de LaundryReport
        textiles,
        bedrooms: property?.numeroCamas || 0,
        bathrooms: property?.numeroBanos || 0,
        totalItems
      };
    });
};
