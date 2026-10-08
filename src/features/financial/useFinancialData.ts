import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildServices, readAllPages, type SourceTask, type SourceProperty, type ConsumptionRule } from './financialSource';
import { formatMadridDate } from '@/utils/date';

export function useFinancialData(sedeId: string | undefined, start: string, end: string) {
  const today = formatMadridDate(new Date());
  return useQuery({
    queryKey: ['financial-analysis', sedeId, start, end, today],
    enabled: !!sedeId && !!start && !!end && start <= end,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [tasks, properties, clients, workers, rules] = await Promise.all([
        readAllPages((from, to) => supabase.from('tasks')
          .select('id,type,date,status,coste,cliente_id,propiedad_id,property,cleaner_id,cleaner,start_time,end_time,duracion,task_assignments(cleaner_id,cleaner_name)')
          .eq('sede_id', sedeId!).gte('date', start).lte('date', end).order('id').range(from, to)),
        readAllPages((from, to) => (supabase as unknown as SupabaseClient).from('properties')
          .select('id,nombre,cliente_id,coste_servicio,duracion_servicio,numero_sabanas,numero_sabanas_pequenas,numero_sabanas_suite,numero_fundas_almohada,numero_toallas_grandes,numero_toallas_pequenas,numero_alfombrines,amenities_cocina,amenities_bano,kit_alimentario,cantidad_rollos_papel_higienico,amenities_control_enabled,property_group_assignments(property_group_id,group:property_groups(id,name,display_name,is_active))')
          .eq('sede_id', sedeId!).order('id').range(from, to)),
        readAllPages((from, to) => (supabase as unknown as SupabaseClient).from('clients').select('id,nombre,amenities_control_enabled').eq('sede_id', sedeId!).order('id').range(from, to)),
        readAllPages((from, to) => supabase.from('cleaners').select('id,name').eq('sede_id', sedeId!).order('id').range(from, to)),
        readAllPages((from, to) => supabase.from('stock_property_consumption_rules')
          .select('property_id,quantity_per_cleaning,product:stock_products(name),property:properties!inner(sede_id)')
          .eq('property.sede_id', sedeId!).eq('is_active', true).order('updated_at').order('id').range(from, to)),
      ]);
      const clientDirectory = clients.map(client => ({ id: client.id as string, name: client.nombre as string, amenitiesControlEnabled: client.amenities_control_enabled as boolean }));
      const propertyRows = properties as SourceProperty[];
      const buildings = new Map<string, { id: string; name: string; propertyIds: string[] }>();
      for (const property of propertyRows) for (const assignment of property.property_group_assignments || []) {
        if (!assignment.group) continue;
        const group = Array.isArray(assignment.group) ? assignment.group[0] : assignment.group;
        if (!group) continue;
        const entry = buildings.get(group.id) || { id: group.id, name: (group.display_name || group.name) + (group.is_active ? '' : ' · inactivo'), propertyIds: [] };
        entry.propertyIds.push(property.id); buildings.set(group.id, entry);
      }
      return { services: buildServices(tasks as unknown as SourceTask[], propertyRows, clientDirectory, workers, today, rules as unknown as ConsumptionRule[]), clients: clientDirectory,
        properties: propertyRows.map(property => ({ id: property.id, name: property.nombre, clientId: property.cliente_id })), workers, buildings: [...buildings.values()] };
    },
  });
}
