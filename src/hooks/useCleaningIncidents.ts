import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface IncidentCategory {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export const useIncidentCategories = () => {
  return useQuery({
    queryKey: ['incident-categories'],
    queryFn: async (): Promise<IncidentCategory[]> => {
      const { data, error } = await supabase
        .from('incident_categories')
        .select('id, slug, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as IncidentCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useClientAllowIncidents = (clientId?: string | null) => {
  return useQuery({
    queryKey: ['client-allow-incidents', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('clients')
        .select('allow_incidents')
        .eq('id', clientId as string)
        .maybeSingle();
      if (error) throw error;
      return !!data?.allow_incidents;
    },
    staleTime: 60 * 1000,
  });
};

const uploadIncidentFile = async (file: File, taskId: string): Promise<string> => {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const isVideo = file.type.startsWith('video/');
  const path = `incidents/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from('task-reports-media')
    .upload(path, file, {
      contentType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      upsert: false,
    });
  if (error) throw error;
  const { data } = supabase.storage.from('task-reports-media').getPublicUrl(path);
  return data.publicUrl;
};

export interface CreateIncidentInput {
  taskId: string;
  categoryId: string;
  description: string;
  location?: string;
  files: File[];
  createAsOpen?: boolean; // admin/manager can publish directly
}

export const useCreateIncident = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: CreateIncidentInput) => {
      if (!input.files || input.files.length < 2) {
        throw new Error('Debes adjuntar al menos 2 archivos (fotos o vídeo)');
      }
      const uploads = await Promise.all(input.files.map((f) => uploadIncidentFile(f, input.taskId)));
      const { data, error } = await supabase.rpc('report_cleaning_incident', {
        _task_id: input.taskId,
        _category_id: input.categoryId,
        _description: input.description,
        _media_urls: uploads,
        _location: input.location ?? null,
        _visibility: 'public',
        _create_as_open: !!input.createAsOpen,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast({
        title: 'Incidencia enviada',
        description: 'Limpatex la revisará antes de mostrarla al cliente.',
      });
      qc.invalidateQueries({ queryKey: ['cleaning-incidents'] });
    },
    onError: (e: any) => {
      toast({
        title: 'No se pudo enviar',
        description: e?.message || 'Error desconocido',
        variant: 'destructive',
      });
    },
  });
};
