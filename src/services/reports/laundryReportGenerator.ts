
import { LaundryReport } from '@/types/reports';

export const generateLaundryReport = (tasks: any[], properties: any[], clients: any[]): LaundryReport[] => {
  return tasks
    .filter(task => task.status !== 'completed') // Solo tareas pendientes y en progreso
    .map(task => {
      const property = properties.find(p => p.nombre === task.property);
      const client = property ? clients.find(c => c.id === property.clienteId) : null;
      
      // Calcular textiles necesarios basado en la propiedad
      const textiles = property ? {
        sabanas: property.numeroSabanas || 0,
        toallasGrandes: property.numeroToallasGrandes || 0,
        toallasPequenas: property.numeroTotallasPequenas || 0,
        alfombrines: property.numeroAlfombrines || 0,
        fundasAlmohada: property.numeroFundasAlmohada || 0,
      } : {
        sabanas: 0,
        toallasGrandes: 0,
        toallasPequenas: 0,
        alfombrines: 0,
        fundasAlmohada: 0,
      };

      const totalItems = Object.values(textiles).reduce((sum, count) => sum + count, 0);

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
        client: client?.nombre || 'Cliente desconocido',
        textiles,
        bedrooms: property?.numeroCamas || 0,
        bathrooms: property?.numeroBanos || 0,
        totalItems
      };
    })
    .sort((a, b) => {
      // Ordenar por fecha y luego por hora
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.startTime.localeCompare(b.startTime);
    });
};
