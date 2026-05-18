import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  ExtraordinaryRequestType,
  ClientExtraordinaryRequest,
  CreateExtraordinaryRequestInput,
} from '@/types/extraordinaryRequest';

const mapType = (row: any): ExtraordinaryRequestType => ({
  id: row.id,
  code: row.code,
  label: row.label,
  icon: row.icon,
  description: row.description,
  defaultDurationMinutes: row.default_duration_minutes,
  requiresTime: row.requires_time,
  defaultCost: Number(row.default_cost ?? 0),
  isActive: row.is_active,
  sortOrder: row.sort_order,
  sedeId: row.sede_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRequest = (row: any): ClientExtraordinaryRequest => ({
  id: row.id,
  clientId: row.client_id,
  propertyId: row.property_id,
  reservationId: row.reservation_id,
  requestTypeId: row.request_type_id,
  requestTypeLabelSnapshot: row.request_type_label_snapshot,
  serviceDate: row.service_date,
  serviceTime: row.service_time,
  guestName: row.guest_name,
  notes: row.notes,
  costSnapshot: Number(row.cost_snapshot ?? 0),
  status: row.status,
  taskId: row.task_id,
  sedeId: row.sede_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  property: row.properties
    ? { id: row.properties.id, nombre: row.properties.nombre, codigo: row.properties.codigo }
    : undefined,
});

// ============= Catálogo de tipos =============

export const useActiveExtraordinaryRequestTypes = () => {
  return useQuery({
    queryKey: ['extraordinary-request-types', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extraordinary_request_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapType);
    },
    staleTime: 60 * 1000,
  });
};

export const useAllExtraordinaryRequestTypes = () => {
  return useQuery({
    queryKey: ['extraordinary-request-types', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extraordinary_request_types')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapType);
    },
  });
};

export const useUpsertExtraordinaryRequestType = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (
      input: Partial<ExtraordinaryRequestType> & { id?: string; code: string; label: string }
    ) => {
      const payload: any = {
        code: input.code,
        label: input.label,
        icon: input.icon ?? null,
        description: input.description ?? null,
        default_duration_minutes: input.defaultDurationMinutes ?? 15,
        requires_time: input.requiresTime ?? false,
        default_cost: input.defaultCost ?? 0,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 0,
        sede_id: input.sedeId ?? null,
      };
      if (input.id) {
        const { error } = await supabase
          .from('extraordinary_request_types')
          .update(payload)
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('extraordinary_request_types')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extraordinary-request-types'] });
      toast({ title: 'Guardado', description: 'Tipo de servicio guardado correctamente.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message ?? 'No se pudo guardar.', variant: 'destructive' });
    },
  });
};

export const useDeleteExtraordinaryRequestType = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('extraordinary_request_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['extraordinary-request-types'] });
      toast({ title: 'Eliminado', description: 'Tipo de servicio eliminado.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message ?? 'No se pudo eliminar.', variant: 'destructive' });
    },
  });
};

// ============= Solicitudes del cliente =============

export const useClientExtraordinaryRequests = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-extraordinary-requests', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_extraordinary_requests')
        .select('*, properties:property_id(id, nombre, codigo)')
        .eq('client_id', clientId)
        .order('service_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRequest);
    },
    enabled: !!clientId,
  });
};

export const useAllExtraordinaryRequests = () => {
  return useQuery({
    queryKey: ['extraordinary-requests', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_extraordinary_requests')
        .select('*, properties:property_id(id, nombre, codigo), clients:client_id(id, nombre)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...mapRequest(row),
        clientName: row.clients?.nombre,
      }));
    },
  });
};

export const useCreateExtraordinaryRequest = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: CreateExtraordinaryRequestInput) => {
      const { data, error } = await supabase.rpc('create_extraordinary_request_with_task', {
        _client_id: input.clientId,
        _property_id: input.propertyId,
        _request_type_id: input.requestTypeId,
        _service_date: input.serviceDate,
        _service_time: input.serviceTime ?? null,
        _guest_name: input.guestName ?? null,
        _notes: input.notes ?? null,
        _reservation_id: input.reservationId ?? null,
      });
      if (error) throw error;

      // Disparar email de notificación al admin (no bloqueante)
      const result = data as any;
      try {
        await supabase.functions.invoke('notify-extraordinary-request', {
          body: { request_id: result?.request_id },
        });
      } catch (e) {
        console.warn('No se pudo enviar email de notificación:', e);
      }

      return result;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['client-extraordinary-requests', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['extraordinary-requests'] });
      toast({
        title: 'Solicitud creada',
        description: 'Hemos registrado tu solicitud de servicio extraordinario.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo crear la solicitud',
        description: err.message ?? 'Error desconocido',
        variant: 'destructive',
      });
    },
  });
};

export const useCancelExtraordinaryRequest = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('cancel_extraordinary_request', { _request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-extraordinary-requests'] });
      qc.invalidateQueries({ queryKey: ['extraordinary-requests'] });
      toast({ title: 'Solicitud cancelada' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message ?? 'No se pudo cancelar.', variant: 'destructive' });
    },
  });
};

// ============= Toggle por cliente (admin) =============

export const useToggleClientExtraordinaryRequests = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ clientId, enabled }: { clientId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('clients')
        .update({ allow_extraordinary_requests: enabled })
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-client-portals'] });
      qc.invalidateQueries({ queryKey: ['client-portal-settings', vars.clientId] });
      toast({
        title: vars.enabled ? 'Solicitudes extraordinarias habilitadas' : 'Solicitudes extraordinarias deshabilitadas',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message ?? 'No se pudo actualizar.', variant: 'destructive' });
    },
  });
};

// ============= Toggle de incidencias por cliente (admin) =============

export const useToggleClientIncidents = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ clientId, enabled }: { clientId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('clients')
        .update({ allow_incidents: enabled } as any)
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-client-portals'] });
      qc.invalidateQueries({ queryKey: ['client-portal-settings', vars.clientId] });
      toast({
        title: vars.enabled ? 'Incidencias habilitadas' : 'Incidencias deshabilitadas',
        description: vars.enabled
          ? 'Las limpiadoras podrán reportar incidencias y el cliente las verá en su portal.'
          : 'El cliente ya no verá la pestaña de incidencias.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message ?? 'No se pudo actualizar.', variant: 'destructive' });
    },
  });
};

