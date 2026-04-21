import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';

export interface StaffingTarget {
  id: string;
  sede_id: string | null;
  day_of_week: number;
  min_workers: number;
  min_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useStaffingTargets = () => {
  const { activeSede } = useSede();
  const sedeId = activeSede?.id ?? null;

  return useQuery({
    queryKey: ['staffing-targets', sedeId],
    queryFn: async () => {
      let q = supabase.from('staffing_targets').select('*').order('day_of_week');
      if (sedeId) q = q.eq('sede_id', sedeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StaffingTarget[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpsertStaffingTarget = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: async (input: {
      day_of_week: number;
      min_workers: number;
      min_hours: number;
      notes?: string | null;
    }) => {
      const payload = {
        sede_id: activeSede?.id ?? null,
        day_of_week: input.day_of_week,
        min_workers: input.min_workers,
        min_hours: input.min_hours,
        notes: input.notes ?? null,
      };
      const { data, error } = await supabase
        .from('staffing_targets')
        .upsert(payload, { onConflict: 'sede_id,day_of_week' })
        .select()
        .single();
      if (error) throw error;
      return data as StaffingTarget;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffing-targets'] });
      queryClient.invalidateQueries({ queryKey: ['staffing-forecast'] });
      toast({ title: 'Objetivo actualizado', description: 'La plantilla mínima ha sido guardada.' });
    },
    onError: (e: Error) => {
      console.error('Error upserting staffing target:', e);
      toast({ title: 'Error', description: 'No se pudo guardar el objetivo.', variant: 'destructive' });
    },
  });
};
