
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
        sabanasRequenas: property?.numeroSabanasRequenas || 0,
        sabanasSuite: property?.numeroSabanasSuite || 0,
        toallasGrandes: property?.numeroToallasGrandes || 0,
        toallasPequenas: property?.numeroTotallasPequenas || 0,
        alfombrines: property?.numeroAlfombrines || 0,
        fundasAlmohada: property?.numeroFundasAlmohada || 0
      };

      const kitAlimentario = property?.kitAlimentario || 0;

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

      // Crear el texto de incidencias con nombre y código de propiedad
      const incidenciasText = property ? 
        `${property.nombre} (${property.codigo})` : 
        'Propiedad desconocida';

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
        serviceType: formatServiceType(task.type),
        taskStatus: task.status === 'completed' ? 'Completada' :
                   task.status === 'in-progress' ? 'En Progreso' : 'Pendiente',
        totalCost: property?.costeServicio || task.coste || 0,
        serviceHours: (task.duration || 0) / 60, // Convertir minutos a horas
        workTeam: task.cleaner || 'Sin asignar',
        paymentMethod: client?.metodoPago || task.metodo_pago || 'No especificado',
        incidents: incidenciasText,

        // Campos específicos de LaundryReport
        textiles,
        bedrooms: property?.numeroCamas || 0,
        bedroomsSmall: property?.numeroCamasPequenas || 0,
        bedroomsSuite: property?.numeroCamasSuite || 0,
        sofaBeds: property?.numeroSofasCama || 0,
        bathrooms: property?.numeroBanos || 0,
        kitAlimentario,
        amenitiesBano: property?.amenitiesBano || 0,
        amenitiesCocina: property?.amenitiesCocina || 0,
        rollosPapelHigienico: property?.cantidadRollosPapelHigienico || 0,
        rollosPapelCocina: property?.cantidadRollosPapelCocina || 0
      };
    });
};
