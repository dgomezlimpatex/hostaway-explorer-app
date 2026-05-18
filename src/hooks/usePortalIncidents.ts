import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type PortalIncidentStatus = 'open' | 'in_progress' | 'resolved' | 'discarded';

export interface PortalIncident {
  id: string;
  task_id: string;
  client_id: string;
  property_id: string | null;
  description: string;
  location: string | null;
  status: PortalIncidentStatus;
  created_at: string;
  approved_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  client_discard_reason: string | null;
  category?: { id: string; label: string; slug: string } | null;
  property?: { id: string; nombre: string; codigo: string | null } | null;
  media?: Array<{ id: string; url: string; kind: string }>;
}

export const usePortalIncidents = (clientId?: string) => {
  return useQuery({
    queryKey: ['portal-incidents', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<PortalIncident[]> => {
      const { data, error } = await supabase
        .from('cleaning_incidents')
        .select(`
          id, task_id, client_id, property_id, description, location, status,
          created_at, approved_at, resolved_at, resolution_note, client_discard_reason,
          category:incident_categories(id, label, slug),
          property:properties(id, nombre, codigo),
          media:cleaning_incident_media(id, url, kind)
        `)
        .eq('client_id', clientId as string)
        .in('status', ['open', 'in_progress', 'resolved', 'discarded'])
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as PortalIncident[];
    },
    staleTime: 30 * 1000,
  });
};

export const usePortalIncidentEvents = (incidentId?: string | null) => {
  return useQuery({
    queryKey: ['portal-incident-events', incidentId],
    enabled: !!incidentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_incident_events')
        .select('id, event_type, from_status, to_status, note, actor_name, created_at')
        .eq('incident_id', incidentId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
};

interface UpdateInput {
  incidentId: string;
  toStatus: 'resolved' | 'discarded' | 'in_progress';
  note?: string;
  clientId?: string;
}

export const usePortalUpdateIncident = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ incidentId, toStatus, note }: UpdateInput) => {
      const { error } = await supabase.rpc('client_update_incident_status', {
        _incident_id: incidentId,
        _to_status: toStatus,
        _note: note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast({ title: 'Incidencia actualizada' });
      qc.invalidateQueries({ queryKey: ['portal-incidents', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['portal-incident-events', vars.incidentId] });
    },
    onError: (e: any) =>
      toast({ title: 'No se pudo actualizar', description: e?.message, variant: 'destructive' }),
  });
};
