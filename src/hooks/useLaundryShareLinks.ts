import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSede } from '@/contexts/SedeContext';

export interface LaundryShareLink {
  id: string;
  token: string;
  createdBy: string;
  sedeId: string | null;
  dateStart: string;
  dateEnd: string;
  expiresAt: string | null;
  isPermanent: boolean;
  isActive: boolean;
  snapshotTaskIds: string[];
  originalTaskIds: string[]; // All tasks at creation time (for detecting truly new tasks)
  filters: Record<string, any>;
  linkType: string | null; // 'scheduled' or 'legacy' or null
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
const mapToShareLink = (row: any): LaundryShareLink => ({
  id: row.id,
  token: row.token,
  createdBy: row.created_by,
  sedeId: row.sede_id,
  dateStart: row.date_start,
  dateEnd: row.date_end,
  expiresAt: row.expires_at,
  isPermanent: row.is_permanent,
  isActive: row.is_active,
  snapshotTaskIds: row.snapshot_task_ids || [],
  originalTaskIds: row.original_task_ids || row.snapshot_task_ids || [], // Fallback to snapshot for old links
  filters: row.filters || {},
  linkType: row.link_type,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
      
      const { data, error } = await supabase
        .from('laundry_share_links')
        .insert({
          token,
          created_by: userData.user.id,
          sede_id: params.sedeId,
          date_start: params.dateStart,
          date_end: params.dateEnd,
          expires_at: params.isPermanent ? null : params.expiresAt,
          is_permanent: params.isPermanent,
          snapshot_task_ids: params.taskIds,
          original_task_ids: params.allTaskIds, // Store all tasks at creation time
          filters: params.filters || {},
          link_type: params.linkType || 'legacy',
        })
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
  // mode 'merge': only ADD new tasks to snapshot, keep existing ones (preserves manual edits)
  // silent: skip toast notification (used for auto-merge in background)
  const applyTaskChanges = useMutation({
    mutationFn: async ({ 
      linkId, 
      currentTaskIds, 
      existingSnapshotIds,
      mode = 'replace',
      silent = false,
    }: { 
      linkId: string; 
      currentTaskIds: string[]; 
      existingSnapshotIds?: string[];
      mode?: 'replace' | 'merge';
      silent?: boolean;
    }) => {
      let nextSnapshot = currentTaskIds;
      
      if (mode === 'merge' && existingSnapshotIds) {
        // Add new tasks to snapshot without removing existing ones
        const set = new Set(existingSnapshotIds);
        currentTaskIds.forEach(id => set.add(id));
        nextSnapshot = Array.from(set);
      }
      
      const { error } = await supabase
        .from('laundry_share_links')
        .update({
          snapshot_task_ids: nextSnapshot,
          original_task_ids: currentTaskIds, // Always update baseline to current
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
