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
