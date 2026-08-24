import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';
import { getDateDayOfWeek, orderClassicLaundryTaskIds } from '@/services/laundryRouteOrderService';

export interface LaundryShareLink {
  id: string;
  token: string;
  createdBy: string;
  sedeId: string | null;
  dateStart: string;
  dateEnd: string;
  deliveryDay: number | null;
  expiresAt: string | null;
  isPermanent: boolean;
  isActive: boolean;
  snapshotTaskIds: string[];
  originalTaskIds: string[]; // All tasks at creation time (for detecting truly new tasks)
  filters: Record<string, any>;
  linkType: string | null; // 'scheduled' or 'legacy' or null
  workflowVersion: string | null;
  routeOrderApplied: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateShareLinkParams {
  dateStart: string;
  dateEnd: string;
  expiresAt?: string | null;
  isPermanent: boolean;
  taskIds: string[];
  allTaskIds: string[]; // All tasks at creation time
  filters?: Record<string, any>;
  linkType?: string; // 'scheduled' or undefined for legacy
  workflowVersion?: string;
  deliveryDay?: number | null;
  routeOrderApplied?: boolean;
}

// Generate a random token for share links
const generateToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

// Map database row to camelCase interface
const mapToShareLink = (row: any): LaundryShareLink => {
  const filters = row.filters || {};
  const deliveryDay = row.delivery_day
    ?? (filters.deliveryDate ? getDateDayOfWeek(filters.deliveryDate) : null);

  return {
  id: row.id,
  token: row.token,
  createdBy: row.created_by,
  sedeId: row.sede_id,
  dateStart: row.date_start,
  dateEnd: row.date_end,
  deliveryDay,
  expiresAt: row.expires_at,
  isPermanent: row.is_permanent,
  isActive: row.is_active,
  snapshotTaskIds: row.snapshot_task_ids || [],
  originalTaskIds: row.original_task_ids || row.snapshot_task_ids || [], // Fallback to snapshot for old links
  filters,
  linkType: row.link_type,
  workflowVersion: row.workflow_version || 'legacy',
  routeOrderApplied: row.route_order_applied === true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  };
};

export const useLaundryShareLinks = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  // Fetch all active share links for the current sede
  const { data: shareLinks, isLoading, error, refetch } = useQuery({
    queryKey: ['laundry-share-links', activeSede?.id],
    queryFn: async () => {
      if (!activeSede?.id) return [];
      
      const { data, error } = await supabase
        .from('laundry_share_links')
        .select('*')
        .eq('is_active', true)
        .eq('sede_id', activeSede.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapToShareLink);
    },
    enabled: !!activeSede?.id,
  });

  // Create a new share link
  const createShareLink = useMutation({
    mutationFn: async (params: CreateShareLinkParams & { sedeId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuario no autenticado');

      const token = generateToken();
      const workflowVersion = params.workflowVersion || 'legacy';
      const isClassicLink = workflowVersion !== 'route_v2';
      // Classic links must always preserve the configured route order. Keeping
      // this invariant here protects every creation path, including quick links.
      const routeOrderApplied = isClassicLink;
      const deliveryDay = params.deliveryDay
        ?? (params.filters?.deliveryDate
          ? getDateDayOfWeek(params.filters.deliveryDate)
          : isClassicLink
            ? getDateDayOfWeek(params.dateStart)
            : null);
      const snapshotTaskIds = routeOrderApplied
        ? await orderClassicLaundryTaskIds({
            taskIds: params.taskIds,
            sedeId: params.sedeId,
            dateStart: params.dateStart,
            deliveryDay,
          })
        : params.taskIds;
      
      const insertData = {
        token,
        created_by: userData.user.id,
        sede_id: params.sedeId,
        date_start: params.dateStart,
        date_end: params.dateEnd,
        delivery_day: deliveryDay,
        expires_at: params.isPermanent ? null : params.expiresAt,
        is_permanent: params.isPermanent,
        snapshot_task_ids: snapshotTaskIds,
        original_task_ids: params.allTaskIds, // Store all tasks at creation time
        filters: params.filters || {},
        link_type: params.linkType || 'legacy',
        workflow_version: workflowVersion,
        route_order_applied: routeOrderApplied,
      };

      const { data, error } = await (supabase as any)
        .from('laundry_share_links')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return mapToShareLink(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laundry-share-links'] });
      toast({
        title: 'Enlace creado',
        description: 'El enlace compartible ha sido generado correctamente',
      });
    },
    onError: (error) => {
      console.error('Error creating share link:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el enlace compartible',
        variant: 'destructive',
      });
    },
  });

  // Apply current task changes to a share link
  // mode 'replace' (default): rewrite snapshot to match current tasks exactly (removes deleted ones)
  // mode 'merge': only ADD genuinely NEW tasks (current \ original) to the snapshot,
  //               preserving manual exclusions made by an admin in the edit modal.
  // silent: skip toast notification (used for auto-merge in background)
  const applyTaskChanges = useMutation({
    mutationFn: async ({ 
      linkId, 
      currentTaskIds, 
      existingSnapshotIds,
      originalTaskIds,
      mode = 'replace',
      silent = false,
    }: { 
      linkId: string; 
      currentTaskIds: string[]; 
      existingSnapshotIds?: string[];
      originalTaskIds?: string[];
      mode?: 'replace' | 'merge';
      silent?: boolean;
    }) => {
      const { data: linkRow, error: linkError } = await (supabase as any)
        .from('laundry_share_links')
        .select('date_start, sede_id, delivery_day, link_type, workflow_version')
        .eq('id', linkId)
        .single();

      if (linkError) throw linkError;

      const isClassicLink = linkRow.workflow_version !== 'route_v2';
      const orderedCurrentTaskIds = isClassicLink
        ? await orderClassicLaundryTaskIds({
            taskIds: currentTaskIds,
            sedeId: linkRow.sede_id,
            dateStart: linkRow.date_start,
            deliveryDay: linkRow.delivery_day,
          })
        : currentTaskIds;

      let nextSnapshot = orderedCurrentTaskIds;
      
      if (mode === 'merge' && existingSnapshotIds) {
        // Only add tasks that didn't exist in the previous baseline (genuinely new).
        // This preserves any manual exclusion the admin did via the edit modal:
        // tasks excluded manually are in `originalTaskIds` but NOT in
        // `existingSnapshotIds`, so they will NOT be re-added.
        const originalSet = new Set(originalTaskIds || existingSnapshotIds);
        const snapshotSet = new Set(existingSnapshotIds);
        nextSnapshot = orderedCurrentTaskIds.filter((id) => snapshotSet.has(id) || !originalSet.has(id));
      }
      
      const { error } = await (supabase as any)
        .from('laundry_share_links')
        .update({
          snapshot_task_ids: nextSnapshot,
          original_task_ids: orderedCurrentTaskIds, // Always update baseline to current
          ...(isClassicLink ? { route_order_applied: true } : {}),
        })
        .eq('id', linkId);

      if (error) throw error;
      return { silent };
    },
    onSuccess: ({ silent }) => {
      queryClient.invalidateQueries({ queryKey: ['laundry-share-links'] });
      queryClient.invalidateQueries({ queryKey: ['share-link-changes'] });
      queryClient.invalidateQueries({ queryKey: ['share-link-properties'] });
      if (!silent) {
        toast({
          title: 'Cambios aplicados',
          description: 'El enlace se ha actualizado con las tareas actuales',
        });
      }
    },
    onError: (error) => {
      console.error('Error applying changes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron aplicar los cambios',
        variant: 'destructive',
      });
    },
  });

  // Deactivate a share link
  const deactivateShareLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('laundry_share_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laundry-share-links'] });
      toast({
        title: 'Enlace desactivado',
        description: 'El enlace ya no es accesible',
      });
    },
    onError: (error) => {
      console.error('Error deactivating share link:', error);
      toast({
        title: 'Error',
        description: 'No se pudo desactivar el enlace',
        variant: 'destructive',
      });
    },
  });

  return {
    shareLinks,
    isLoading,
    error,
    refetch,
    createShareLink,
    deactivateShareLink,
    applyTaskChanges,
  };
};

// Hook for fetching a single share link by token (public, no auth required)
export const useLaundryShareLinkByToken = (token: string | undefined) => {
  return useQuery({
    queryKey: ['laundry-share-link', token],
    queryFn: async () => {
      if (!token) throw new Error('Token requerido');

      const { data, error } = await supabase
        .from('laundry_share_links')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      
      // Check if link has expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error('Este enlace ha expirado');
      }

      return mapToShareLink(data);
    },
    enabled: !!token,
    retry: false,
  });
};
