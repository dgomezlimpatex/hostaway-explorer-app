
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { ClientBillingReport, PropertyBillingDetail, TaskBillingDetail } from '@/types/reports';

interface ClientBillingFilters {
  dateRange: 'today' | 'week' | 'month' | 'custom' | 'all';
  startDate?: Date;
  endDate?: Date;
  clientId?: string;
}

export const useClientBillingReport = (filters: ClientBillingFilters) => {
  const { activeSede } = useSede();

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['clientBillingReport', filters, activeSede?.id],
    queryFn: async () => {
      // Fetch tasks with status completed
      let tasksQuery = supabase
        .from('tasks')
        .select('*')
        .eq('status', 'completed');

      if (activeSede?.id) {
        tasksQuery = tasksQuery.eq('sede_id', activeSede.id);
      }

      // Apply date filters
      if (filters.startDate) {
        tasksQuery = tasksQuery.gte('date', filters.startDate.toISOString().split('T')[0]);
      }
      if (filters.endDate) {
        tasksQuery = tasksQuery.lte('date', filters.endDate.toISOString().split('T')[0]);
      }

      // Apply client filter if specified
      if (filters.clientId) {
        tasksQuery = tasksQuery.eq('cliente_id', filters.clientId);
      }

      const { data: tasks, error: tasksError } = await tasksQuery;
      if (tasksError) throw tasksError;

      // Fetch clients
      let clientsQuery = supabase.from('clients').select('*');
      if (activeSede?.id) {
        clientsQuery = clientsQuery.eq('sede_id', activeSede.id);
      }
      const { data: clients, error: clientsError } = await clientsQuery;
      if (clientsError) throw clientsError;

      // Fetch properties
      let propertiesQuery = supabase.from('properties').select('*');
      if (activeSede?.id) {
        propertiesQuery = propertiesQuery.eq('sede_id', activeSede.id);
      }
      const { data: properties, error: propertiesError } = await propertiesQuery;
      if (propertiesError) throw propertiesError;

      return { tasks: tasks || [], clients: clients || [], properties: properties || [] };
    },
  });

  const reportData = useMemo<ClientBillingReport[]>(() => {
    if (!rawData) return [];

    const { tasks, clients, properties } = rawData;

    // Create lookup maps
    const clientsMap = new Map(clients.map(c => [c.id, c]));
    const propertiesMap = new Map(properties.map(p => [p.id, p]));

    // Group tasks by client
    const tasksByClient = new Map<string, typeof tasks>();
    tasks.forEach(task => {
      const clientId = task.cliente_id;
      if (!clientId) return;
      
      if (!tasksByClient.has(clientId)) {
        tasksByClient.set(clientId, []);
      }
      tasksByClient.get(clientId)!.push(task);
    });

    // Build report structure
    const reports: ClientBillingReport[] = [];

    tasksByClient.forEach((clientTasks, clientId) => {
      const client = clientsMap.get(clientId);
      if (!client) return;

      // Group by property
      const tasksByProperty = new Map<string, typeof tasks>();
      clientTasks.forEach(task => {
        const propertyId = task.propiedad_id;
        if (!propertyId) return;
        
        if (!tasksByProperty.has(propertyId)) {
          tasksByProperty.set(propertyId, []);
        }
        tasksByProperty.get(propertyId)!.push(task);
      });

      const propertiesData: PropertyBillingDetail[] = [];
      let totalClientCost = 0;
      let totalClientServices = 0;

      tasksByProperty.forEach((propertyTasks, propertyId) => {
        const property = propertiesMap.get(propertyId);
        if (!property) return;

        // Use property's coste_servicio as fallback when task has no cost
        const defaultCost = property.coste_servicio || 0;

        const taskDetails: TaskBillingDetail[] = propertyTasks.map(task => ({
          taskId: task.id,
          date: task.date,
          type: task.type || 'Limpieza',
          duration: task.duracion || property.duracion_servicio || 0,
          cost: task.coste != null && task.coste > 0 ? task.coste : defaultCost,
          status: task.status,
          cleaner: task.cleaner || 'Sin asignar',
          checkIn: task.check_in || '',
          checkOut: task.check_out || '',
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const propertyCost = taskDetails.reduce((sum, t) => sum + t.cost, 0);
        
        propertiesData.push({
          propertyId,
          propertyName: property.nombre,
          propertyCode: property.codigo,
          direccion: property.direccion,
          totalCleanings: taskDetails.length,
          totalCost: propertyCost,
          tasks: taskDetails,
        });

        totalClientCost += propertyCost;
        totalClientServices += taskDetails.length;
      });

      // Sort properties alphabetically by name
      propertiesData.sort((a, b) => a.propertyName.localeCompare(b.propertyName));

      reports.push({
        clientId,
        clientName: client.nombre,
        cifNif: client.cif_nif || '',
        direccionFacturacion: client.direccion_facturacion || '',
        metodoPago: client.metodo_pago || '',
        totalServices: totalClientServices,
        totalCost: totalClientCost,
        properties: propertiesData,
      });
    });

    // Sort by total services descending
    reports.sort((a, b) => b.totalServices - a.totalServices);

    return reports;
  }, [rawData]);

  return {
    data: reportData,
    isLoading,
    error,
  };
};
