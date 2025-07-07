import { useQuery } from '@tanstack/react-query';
import { taskMediaStorageService } from '@/services/storage/taskMediaStorage';
import { TaskMedia } from '@/types/taskReports';

export const useTaskMedia = (reportId?: string) => {
  return useQuery({
    queryKey: ['task-media', reportId],
    queryFn: () => reportId ? taskMediaStorageService.getTaskMedia(reportId) : Promise.resolve([]),
    enabled: !!reportId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAllTaskMedia = () => {
  return useQuery({
    queryKey: ['all-task-media'],
    queryFn: async () => {
      // Fetch all media from all reports
      const { data, error } = await supabase
        .from('task_media')
        .select(`
          *,
          task_reports!inner(
            id,
            task_id,
            cleaner_id,
            overall_status,
            created_at,
            tasks!inner(
              property,
              address,
              cleaner
            )
          )
        `)
        .order('timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Import supabase for the query above
import { supabase } from '@/integrations/supabase/client';