import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type LaundryDeliveryStatus = 'pending' | 'prepared' | 'delivered';

export interface LaundryDeliveryTracking {
  id: string;
  shareLinkId: string;
  taskId: string;
  status: LaundryDeliveryStatus;
  preparedAt: string | null;
  preparedByName: string | null;
  deliveredAt: string | null;
  deliveredByName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UpdateTrackingParams {
  shareLinkId: string;
  taskId: string;
  status: LaundryDeliveryStatus;
  personName: string;
  notes?: string;
}

// Map database row to camelCase interface
const mapToTracking = (row: any): LaundryDeliveryTracking => ({
  id: row.id,
  shareLinkId: row.share_link_id,
  taskId: row.task_id,
  status: row.status,
  preparedAt: row.prepared_at,
  preparedByName: row.prepared_by_name,
  deliveredAt: row.delivered_at,
  deliveredByName: row.delivered_by_name,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const useLaundryTracking = (shareLinkId: string | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all tracking for a share link
  const { data: trackingData, isLoading, error, refetch } = useQuery({
    queryKey: ['laundry-tracking', shareLinkId],
    queryFn: async () => {
      if (!shareLinkId) return [];

      const { data, error } = await supabase
        .from('laundry_delivery_tracking')
        .select('*')
        .eq('share_link_id', shareLinkId);

      if (error) throw error;
      return (data || []).map(mapToTracking);
    },
    enabled: !!shareLinkId,
  });

  // Update or create tracking status
  const updateTracking = useMutation({
    mutationFn: async (params: UpdateTrackingParams) => {
      const now = new Date().toISOString();
      
      // Check if tracking record exists
      const { data: existing } = await supabase
        .from('laundry_delivery_tracking')
        .select('id, status')
        .eq('share_link_id', params.shareLinkId)
        .eq('task_id', params.taskId)
        .single();

      if (existing) {
        // Update existing record
        const updateData: any = {
          status: params.status,
          notes: params.notes,
        };

        if (params.status === 'prepared') {
          updateData.prepared_at = now;
          updateData.prepared_by_name = params.personName;
        } else if (params.status === 'delivered') {
          updateData.delivered_at = now;
          updateData.delivered_by_name = params.personName;
        }

        const { data, error } = await supabase
          .from('laundry_delivery_tracking')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return mapToTracking(data);
      } else {
        // Create new record
        const insertData: any = {
          share_link_id: params.shareLinkId,
          task_id: params.taskId,
          status: params.status,
          notes: params.notes,
        };

        if (params.status === 'prepared') {
          insertData.prepared_at = now;
          insertData.prepared_by_name = params.personName;
        } else if (params.status === 'delivered') {
          insertData.delivered_at = now;
          insertData.delivered_by_name = params.personName;
        }

        const { data, error } = await supabase
          .from('laundry_delivery_tracking')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        return mapToTracking(data);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['laundry-tracking', shareLinkId] });
      const statusText = data.status === 'prepared' ? 'preparada' : 'entregada';
      toast({
        title: `Bolsa ${statusText}`,
        description: `Marcada por ${data.status === 'prepared' ? data.preparedByName : data.deliveredByName}`,
      });
    },
    onError: (error) => {
      console.error('Error updating tracking:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    },
  });

  // Get tracking status for a specific task
  const getTaskTracking = (taskId: string): LaundryDeliveryTracking | undefined => {
    return trackingData?.find(t => t.taskId === taskId);
  };

  // Calculate statistics
  const stats = {
    total: trackingData?.length || 0,
    pending: trackingData?.filter(t => t.status === 'pending').length || 0,
    prepared: trackingData?.filter(t => t.status === 'prepared').length || 0,
    delivered: trackingData?.filter(t => t.status === 'delivered').length || 0,
  };

  return {
    trackingData,
    isLoading,
    error,
    refetch,
    updateTracking,
    getTaskTracking,
    stats,
  };
};

// Hook for manager to view all tracking across all links
export const useAllLaundryTracking = () => {
  return useQuery({
    queryKey: ['all-laundry-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('laundry_delivery_tracking')
        .select(`
          *,
          laundry_share_links (
            token,
            date_start,
            date_end,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};
