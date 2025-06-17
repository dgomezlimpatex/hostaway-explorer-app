
import { LaundryReport } from '@/types/reports';

export const generateLaundryReport = (tasks: any[], properties: any[], clients: any[]): LaundryReport[] => {
  return tasks
    .filter(task => task.status !== 'completed') // Solo tareas pendientes y en progreso
    .map(task => {
      const property = properties.find(p => p.id === task.propiedad_id || p.nombre === task.property);
      const client = property ? clients.find(c => c.id === property.cliente_id) : null;
      
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

      // Formatear tipo de servicio
      const formatServiceType = (type: string) => {
        if (type?.toLowerCase().includes('mantenimiento') && type?.toLowerCase().includes('airbnb')) {
          return 'Mantenimiento Airbnb';
        }
        return type || 'Mantenimiento Airbnb';
      };

      // Formatear estado de la tarea
      const formatTaskStatus = (status: string) => {
        switch (status) {
          case 'completed': return 'Completada';
          case 'in-progress': return 'En Progreso';
          case 'cancelled': return 'Cancelada';
          default: return 'Pendiente';
        }
      };

      // Generar incidencias automáticamente con nombre y código del piso
      const generateIncidencias = () => {
        if (property) {
          return `${property.nombre} (${property.codigo})`;
        }
        return task.property || 'Propiedad no especificada';
      };

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
        client: client?.nombre || 'Cliente desconocido',
        // Nuevos campos requeridos por TaskReport
        serviceDate: task.date,
        supervisor: client?.supervisor || 'Sin supervisor',
        serviceType: formatServiceType(task.type),
        taskStatus: formatTaskStatus(task.status),
        totalCost: task.coste || property?.coste_servicio || 0,
        workTeam: task.cleaner || 'Sin asignar',
        paymentMethod: client?.metodoPago || 'Sin especificar',
        incidents: generateIncidencias(),
        // Campos específicos de LaundryReport
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
