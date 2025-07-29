import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GroupedTaskReport } from '@/types/groupedTaskReports';

export const useGroupedTaskReports = () => {
  return useQuery({
    queryKey: ['groupedTaskReports'],
    queryFn: async (): Promise<GroupedTaskReport[]> => {
      const { data, error } = await supabase
        .from('task_reports_grouped')
        .select('*');

      if (error) {
        throw new Error(`Error fetching grouped task reports: ${error.message}`);
      }

      return (data || []).map(item => ({
        ...item,
        individual_reports: item.individual_reports as any
      })) as GroupedTaskReport[];
    },
  });
};

export const useGroupedTaskReport = (taskId: string) => {
  // Para tareas virtuales (con _assignment_), usar el originalTaskId
  const actualTaskId = taskId?.includes('_assignment_') 
    ? taskId.split('_assignment_')[0] 
    : taskId;

  return useQuery({
    queryKey: ['groupedTaskReport', actualTaskId],
    queryFn: async (): Promise<GroupedTaskReport | null> => {
      const { data, error } = await supabase
        .from('task_reports_grouped')
        .select('*')
        .eq('task_id', actualTaskId)
        .maybeSingle();

      if (error) {
        throw new Error(`Error fetching grouped task report: ${error.message}`);
      }

      return data ? {
        ...data,
        individual_reports: data.individual_reports as any
      } as GroupedTaskReport : null;
    },
    enabled: !!actualTaskId && actualTaskId !== 'undefined',
  });
};