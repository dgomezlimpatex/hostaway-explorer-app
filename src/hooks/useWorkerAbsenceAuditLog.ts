import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { WorkerAbsenceAuditLog } from '@/types/workerAbsence';

// Map database row to TypeScript type
const mapAuditLogFromDB = (row: any): WorkerAbsenceAuditLog => ({
  id: row.id,
  referenceId: row.reference_id,
  referenceType: row.reference_type,
  action: row.action,
  cleanerId: row.cleaner_id,
  oldData: row.old_data,
  newData: row.new_data,
  changedBy: row.changed_by,
  changedAt: row.changed_at,
});

// Fetch audit log for a specific cleaner
export const useWorkerAbsenceAuditLog = (cleanerId: string, limit: number = 50) => {
  return useQuery({
    queryKey: ['worker-absence-audit-log', cleanerId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_absence_audit_log')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapAuditLogFromDB);
    },
    enabled: !!cleanerId,
  });
};

// Fetch all recent audit logs (for admin view)
export const useAllWorkerAbsenceAuditLogs = (limit: number = 100) => {
  return useQuery({
    queryKey: ['all-worker-absence-audit-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_absence_audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapAuditLogFromDB);
    },
  });
};
