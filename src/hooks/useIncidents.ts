import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Error desconocido';

export type IncidentStatus =
  | 'pending_limpatex'
  | 'discarded_limpatex'
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'discarded';

export interface IncidentRow {
  id: string;
  task_id: string;
  property_id: string | null;
  client_id: string;
  sede_id: string;
  category_id: string;
  reporter_kind: 'cleaner' | 'limpatex_admin' | string;
  reporter_cleaner_id: string | null;
  location: string | null;
  description: string;
  status: IncidentStatus;
  visibility: 'public' | 'internal';
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  resolved_at: string | null;
  discard_limpatex_reason: string | null;
  client_discard_reason: string | null;
  resolution_note: string | null;
  category?: { id: string; label: string; slug: string } | null;
  property?: { id: string; nombre: string; codigo: string | null } | null;
  client?: { id: string; nombre: string } | null;
  cleaner?: { id: string; name: string } | null;
  media?: Array<{ id: string; url: string; kind: string }>;
  comments?: IncidentComment[];
  events?: Array<{
    id: string;
    event_type: string;
    from_status: IncidentStatus | null;
    to_status: IncidentStatus | null;
    note: string | null;
    actor_name: string | null;
    actor_role: string | null;
    created_at: string;
  }>;
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  body: string;
  author_kind: 'client' | 'limpatex';
  author_user_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface IncidentFilters {
  status?: IncidentStatus | 'all';
  clientId?: string;
  search?: string;
}

const BASE_SELECT = `
  *,
  category:incident_categories(id, label, slug),
  property:properties(id, nombre, codigo),
  client:clients(id, nombre),
  cleaner:cleaners!cleaning_incidents_reporter_cleaner_id_fkey(id, name),
  media:cleaning_incident_media(id, url, kind)
`;

export const useIncidents = (filters: IncidentFilters = {}) => {
  return useQuery({
    queryKey: ['cleaning-incidents', filters],
    queryFn: async (): Promise<IncidentRow[]> => {
      let q = supabase
        .from('cleaning_incidents')
        .select(BASE_SELECT)
        .order('created_at', { ascending: false })
        .limit(500);
      if (filters.status && filters.status !== 'all') {
        q = q.eq('status', filters.status);
      }
      if (filters.clientId) q = q.eq('client_id', filters.clientId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data || []) as unknown as IncidentRow[];
      if (filters.search?.trim()) {
        const s = filters.search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.description?.toLowerCase().includes(s) ||
            r.location?.toLowerCase().includes(s) ||
            r.property?.nombre?.toLowerCase().includes(s) ||
            r.client?.nombre?.toLowerCase().includes(s),
        );
      }
      return rows;
    },
    staleTime: 30 * 1000,
  });
};

export const useIncidentDetail = (incidentId?: string | null) => {
  return useQuery({
    queryKey: ['cleaning-incident', incidentId],
    enabled: !!incidentId,
    queryFn: async (): Promise<IncidentRow | null> => {
      const { data, error } = await supabase
        .from('cleaning_incidents')
        .select(BASE_SELECT)
        .eq('id', incidentId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: events } = await supabase
        .from('cleaning_incident_events')
        .select('id, event_type, from_status, to_status, note, actor_name, actor_role, created_at')
        .eq('incident_id', incidentId as string)
        .order('created_at', { ascending: false });
      let comments: IncidentComment[] = [];
      try {
        // TODO: remove this cast after regenerating Supabase types with cleaning_incident_comments.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: commentsData, error: commentsError } = await (supabase as any)
          .from('cleaning_incident_comments')
          .select('id, incident_id, body, author_kind, author_user_id, author_name, created_at')
          .eq('incident_id', incidentId as string)
          .order('created_at', { ascending: true });
        if (!commentsError) {
          comments = (commentsData as IncidentComment[]) || [];
        }
      } catch (error) {
        console.warn('Incident comments are not available yet', error);
      }
      return {
        ...(data as unknown as IncidentRow),
        events: (events as IncidentRow['events']) || [],
        comments,
      };
    },
  });
};

export const useIncidentStats = (enabled = true) => {
  return useQuery({
    queryKey: ['cleaning-incidents-stats'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cleaning_incidents')
        .select('status');
      if (error) throw error;
      const rows = (data || []) as { status: IncidentStatus }[];
      const count = (s: IncidentStatus) => rows.filter((r) => r.status === s).length;
      return {
        total: rows.length,
        pending_limpatex: count('pending_limpatex'),
        open: count('open'),
        in_progress: count('in_progress'),
        resolved: count('resolved'),
        discarded: count('discarded') + count('discarded_limpatex'),
      };
    },
    staleTime: 30 * 1000,
  });
};

export const useAddIncidentComment = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, userRole } = useAuth();

  return useMutation({
    mutationFn: async ({ incidentId, body }: { incidentId: string; body: string }) => {
      const text = body.trim();
      if (!text) throw new Error('El comentario no puede estar vacío');

      let actorName: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .maybeSingle();
        const profile = prof as { full_name?: string | null; email?: string | null } | null;
        actorName = profile?.full_name || profile?.email || null;
      }

      // TODO: remove this cast after regenerating Supabase types with cleaning_incident_comments.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('cleaning_incident_comments')
        .insert({
          incident_id: incidentId,
          body: text,
          author_kind: 'limpatex',
          author_user_id: user?.id ?? null,
          author_name: actorName || 'Limpatex',
        });
      if (error) throw error;

      await supabase.from('cleaning_incident_events').insert({
        incident_id: incidentId,
        event_type: 'limpatex_comment',
        note: text,
        actor_user_id: user?.id ?? null,
        actor_name: actorName || 'Limpatex',
        actor_role: (userRole as string) ?? null,
      });
    },
    onSuccess: (_data, vars) => {
      toast({ title: 'Comentario añadido' });
      qc.invalidateQueries({ queryKey: ['cleaning-incident', vars.incidentId] });
      qc.invalidateQueries({ queryKey: ['cleaning-incidents'] });
    },
    onError: (e: unknown) =>
      toast({ title: 'No se pudo comentar', description: getErrorMessage(e), variant: 'destructive' }),
  });
};

interface UpdateInput {
  id: string;
  toStatus: IncidentStatus;
  note?: string;
  fromStatus?: IncidentStatus;
}

export const useUpdateIncidentStatus = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, userRole } = useAuth();

  return useMutation({
    mutationFn: async ({ id, toStatus, note, fromStatus }: UpdateInput) => {
      const patch: Record<string, unknown> = { status: toStatus };
      const now = new Date().toISOString();
      if (toStatus === 'open') {
        patch.approved_at = now;
        patch.approved_by = user?.id ?? null;
      }
      if (toStatus === 'resolved') {
        patch.resolved_at = now;
        patch.resolved_by = user?.id ?? null;
        if (note) patch.resolution_note = note;
      }
      if (toStatus === 'discarded_limpatex') {
        patch.discarded_by_limpatex_at = now;
        patch.discarded_by_limpatex_by = user?.id ?? null;
        if (note) patch.discard_limpatex_reason = note;
      }
      if (toStatus === 'discarded' && note) {
        patch.client_discard_reason = note;
      }

      const { error } = await supabase
        .from('cleaning_incidents')
        .update(patch)
        .eq('id', id);
      if (error) throw error;

      // Audit event
      let actorName: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .maybeSingle();
        const profile = prof as { full_name?: string | null; email?: string | null } | null;
        actorName = profile?.full_name || profile?.email || null;
      }
      const eventType =
        toStatus === 'open' && fromStatus === 'pending_limpatex'
          ? 'approved'
          : toStatus === 'discarded_limpatex'
            ? 'discarded_limpatex'
            : 'status_change';

      await supabase.from('cleaning_incident_events').insert({
        incident_id: id,
        event_type: eventType,
        from_status: fromStatus ?? null,
        to_status: toStatus,
        note: note || null,
        actor_user_id: user?.id ?? null,
        actor_name: actorName,
        actor_role: (userRole as string) ?? null,
      });
    },
    onSuccess: () => {
      toast({ title: 'Incidencia actualizada' });
      qc.invalidateQueries({ queryKey: ['cleaning-incidents'] });
      qc.invalidateQueries({ queryKey: ['cleaning-incident'] });
      qc.invalidateQueries({ queryKey: ['cleaning-incidents-stats'] });
    },
    onError: (e: unknown) =>
      toast({ title: 'No se pudo actualizar', description: getErrorMessage(e), variant: 'destructive' }),
  });
};
