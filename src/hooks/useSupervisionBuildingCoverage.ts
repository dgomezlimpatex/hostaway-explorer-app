import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatMadridDate } from '@/utils/date';

export interface SupervisionBuildingCoverage {
  assignedSupervisors: number;
  pending: number;
  inProgress: number;
  completed: number;
  deferred: number;
  blocked: number;
}

export const useSupervisionBuildingCoverage = (date = formatMadridDate(new Date())) => useQuery({
  queryKey: ['supervision-building-coverage', date],
  queryFn: async (): Promise<Record<string, SupervisionBuildingCoverage>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const [assignmentsResult, workItemsResult] = await Promise.all([
      client.from('supervision_building_supervisors').select('property_group_id').eq('is_active', true),
      client.from('supervision_work_items').select('property_group_id,status').eq('scheduled_date', date),
    ]);
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (workItemsResult.error) throw workItemsResult.error;
    const result: Record<string, SupervisionBuildingCoverage> = {};
    for (const row of assignmentsResult.data || []) {
      const current = result[row.property_group_id] || { assignedSupervisors: 0, pending: 0, inProgress: 0, completed: 0, deferred: 0, blocked: 0 };
      current.assignedSupervisors += 1;
      result[row.property_group_id] = current;
    }
    for (const row of workItemsResult.data || []) {
      const current = result[row.property_group_id] || { assignedSupervisors: 0, pending: 0, inProgress: 0, completed: 0, deferred: 0, blocked: 0 };
      if (row.status === 'pending') current.pending += 1;
      else if (row.status === 'in_progress') current.inProgress += 1;
      else if (row.status === 'completed') current.completed += 1;
      else if (row.status === 'deferred') current.deferred += 1;
      else if (row.status === 'blocked') current.blocked += 1;
      result[row.property_group_id] = current;
    }
    return result;
  },
  staleTime: 15_000,
});
