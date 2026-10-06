import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { buildServices, readAllPages, type SourceTask } from './financialSource';

export function useFinancialData(sedeId: string | undefined, start: string, end: string) {
  return useQuery({
    queryKey: ['financial-analysis', sedeId, start, end],
    enabled: !!sedeId && !!start && !!end && start <= end,
    queryFn: async () => {
      const [tasks, properties, clients, workers] = await Promise.all([
        readAllPages((from, to) => supabase.from('tasks')
          .select('id,date,status,coste,cliente_id,propiedad_id,property,cleaner_id,cleaner,start_time,end_time,task_assignments(cleaner_id,cleaner_name),task_reports(cleaner_id,overall_status,start_time,end_time,updated_at)')
          .eq('sede_id', sedeId!).gte('date', start).lte('date', end).order('id').range(from, to)),
        readAllPages((from, to) => supabase.from('properties')
          .select('id,nombre,cliente_id,coste_servicio,duracion_servicio,numero_sabanas,numero_sabanas_pequenas,numero_sabanas_suite,numero_fundas_almohada,numero_toallas_grandes,numero_toallas_pequenas,numero_alfombrines,amenities_cocina,amenities_bano,kit_alimentario,cantidad_rollos_papel_higienico')
          .eq('sede_id', sedeId!).order('id').range(from, to)),
        readAllPages((from, to) => supabase.from('clients').select('id,nombre').eq('sede_id', sedeId!).order('id').range(from, to)),
        readAllPages((from, to) => supabase.from('cleaners').select('id,name').eq('sede_id', sedeId!).order('id').range(from, to)),
      ]);
      const clientDirectory = clients.map(client => ({ id: client.id, name: client.nombre }));
      return { services: buildServices(tasks as unknown as SourceTask[], properties, clientDirectory), clients: clientDirectory,
        properties: properties.map(property => ({ id: property.id, name: property.nombre, clientId: property.cliente_id })), workers };
    },
  });
}
