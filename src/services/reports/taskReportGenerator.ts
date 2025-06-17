
import { TaskReport } from '@/types/reports';

export const generateTaskReport = (tasks: any[], properties: any[], clients: any[]): TaskReport[] => {
  return tasks.map(task => {
    const property = properties.find(p => p.id === task.propiedad_id || p.nombre === task.property);
    const client = property ? clients.find(c => c.id === property.cliente_id) : null;
    
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
      const propertyInfo = property ? `${property.nombre} (${property.codigo})` : task.property;
      return `Servicio realizado en: ${propertyInfo}`;
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
      // Nuevos campos para el CSV
      serviceDate: task.date,
      supervisor: task.supervisor || client?.supervisor || 'Sin supervisor',
      serviceType: formatServiceType(task.type),
      taskStatus: formatTaskStatus(task.status),
      totalCost: task.coste || property?.coste_servicio || 0,
      workTeam: task.cleaner || 'Sin asignar',
      paymentMethod: task.metodo_pago || client?.metodo_pago || 'Sin especificar',
      incidents: generateIncidencias()
    };
  });
};
