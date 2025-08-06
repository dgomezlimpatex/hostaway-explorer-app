
import { TaskReport } from '@/types/reports';

export const generateTaskReport = (tasks: any[], properties: any[], clients: any[]): TaskReport[] => {
  return tasks.map(task => {
    // Para tareas extraordinarias, usar la información específica de facturación extraordinaria
    const isExtraordinaryTask = task.type === 'trabajo-extraordinario';
    
    // Buscar la propiedad asociada a la tarea
    const property = properties.find(p => 
      p.id === task.propiedad_id || 
      p.nombre === task.property ||
      p.codigo === task.property
    );
    
    // Buscar el cliente asociado a la propiedad (para tareas normales)
    const client = property && property.clienteId ? 
      clients.find(c => c.id === property.clienteId) : 
      null;
    
    // Determinar información del cliente según el tipo de tarea
    let clientName, clientSupervisor, clientPaymentMethod;
    
    if (isExtraordinaryTask && task.extraordinaryClientName) {
      // Para tareas extraordinarias, usar información específica
      clientName = task.extraordinaryClientName;
      clientSupervisor = 'Servicio Extraordinario';
      clientPaymentMethod = task.metodo_pago || 'No especificado';
    } else {
      // Para tareas normales, usar información del cliente asociado
      clientName = client?.nombre || task.client || 'Cliente desconocido';
      clientSupervisor = client?.supervisor || task.supervisor || 'Sin supervisor';
      clientPaymentMethod = client?.metodoPago || task.metodo_pago || 'No especificado';
    }
    
    // Mapear método de pago a español
    const paymentMethodSpanish = {
      'transferencia': 'Transferencia',
      'efectivo': 'Efectivo',
      'bizum': 'Bizum'
    }[clientPaymentMethod] || clientPaymentMethod;

    // Formatear el tipo de servicio
    const formatServiceType = (type: string) => {
      if (type === 'mantenimiento-airbnb') {
        return 'Mantenimiento AIRBNB';
      }
      // Capitalizar primera letra de cada palabra
      return type.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    };

    // Determinar información de la propiedad y costo
    let propertyName, propertyAddress, taskCost;
    
    if (isExtraordinaryTask) {
      // Para tareas extraordinarias, usar información directa de la tarea
      propertyName = task.property || 'Servicio Extraordinario';
      propertyAddress = task.address || task.extraordinaryBillingAddress || 'Dirección no disponible';
      taskCost = task.coste || 0;
    } else {
      // Para tareas normales, usar información de la propiedad
      propertyName = task.property || property?.nombre || 'Propiedad desconocida';
      propertyAddress = task.address || property?.direccion || 'Dirección no disponible';
      taskCost = property?.costeServicio || task.coste || 0;
    }
    
    // Crear el texto de incidencias con nombre y código de propiedad
    const incidenciasText = property ? 
      `${property.nombre} (${property.codigo})` : 
      propertyName;

    return {
      id: task.id,
      created_at: task.created_at || new Date().toISOString(),
      updated_at: task.updated_at || new Date().toISOString(),
      property: propertyName,
      address: propertyAddress,
      date: task.date,
      startTime: task.startTime || task.start_time || '00:00',
      endTime: task.endTime || task.end_time || '00:00',
      type: task.type,
      status: task.status,
      cleaner: task.cleaner || 'Sin asignar',
      client: clientName,
      
      // Campos adicionales para exportación CSV
      serviceDate: task.date,
      supervisor: clientSupervisor,
      serviceType: formatServiceType(task.type),
      taskStatus: task.status === 'completed' ? 'Completada' :
                 task.status === 'in-progress' ? 'En Progreso' : 'Pendiente',
      totalCost: taskCost,
      workTeam: task.cleaner || 'Sin asignar',
      paymentMethod: paymentMethodSpanish,
      incidents: incidenciasText
    };
  });
};
