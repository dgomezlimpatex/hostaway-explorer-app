
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ClientPortalAccess, 
  ClientReservation, 
  ClientReservationLog,
  CreateReservationData,
  PortalSession 
} from '@/types/clientPortal';
import { useToast } from '@/hooks/use-toast';

// Generate random 6-digit PIN
export const generateRandomPin = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============= ADMIN HOOKS =============

// Fetch portal access for a specific client
export const useClientPortalAccess = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-portal-access', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from('client_portal_access')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) return null;
      
      return {
        id: data.id,
        clientId: data.client_id,
        accessPin: data.access_pin,
        portalToken: data.portal_token,
        shortCode: data.short_code,
        isActive: data.is_active,
        lastAccessAt: data.last_access_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },
    enabled: !!clientId,
  });
};

// Fetch all portal accesses (for admin overview)
export const useAllClientPortalAccess = () => {
  return useQuery({
    queryKey: ['all-client-portal-access'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_portal_access')
        .select(`
          *,
          clients (
            id,
            nombre
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(item => ({
        id: item.id,
        clientId: item.client_id,
        accessPin: item.access_pin,
        portalToken: item.portal_token,
        isActive: item.is_active,
        lastAccessAt: item.last_access_at,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        clientName: (item.clients as any)?.nombre || 'Cliente desconocido',
      }));
    },
  });
};

// Create or update portal access
export const useCreatePortalAccess = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (clientId: string) => {
      const pin = generateRandomPin();
      
      const { data, error } = await supabase
        .from('client_portal_access')
        .upsert({
          client_id: clientId,
          access_pin: pin,
          is_active: true,
        }, {
          onConflict: 'client_id',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['client-portal-access', clientId] });
      queryClient.invalidateQueries({ queryKey: ['all-client-portal-access'] });
      toast({
        title: 'Portal activado',
        description: 'Se ha generado el acceso al portal para este cliente.',
      });
    },
    onError: (error) => {
      console.error('Error creating portal access:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el acceso al portal.',
        variant: 'destructive',
      });
    },
  });
};

// Regenerate PIN
export const useRegeneratePin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (accessId: string) => {
      const pin = generateRandomPin();
      
      const { data, error } = await supabase
        .from('client_portal_access')
        .update({ access_pin: pin })
        .eq('id', accessId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-portal-access', data.client_id] });
      queryClient.invalidateQueries({ queryKey: ['all-client-portal-access'] });
      toast({
        title: 'PIN regenerado',
        description: 'Se ha generado un nuevo PIN para el cliente.',
      });
    },
    onError: (error) => {
      console.error('Error regenerating PIN:', error);
      toast({
        title: 'Error',
        description: 'No se pudo regenerar el PIN.',
        variant: 'destructive',
      });
    },
  });
};

// Toggle portal active status
export const useTogglePortalStatus = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ accessId, isActive }: { accessId: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('client_portal_access')
        .update({ is_active: isActive })
        .eq('id', accessId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client-portal-access', data.client_id] });
      queryClient.invalidateQueries({ queryKey: ['all-client-portal-access'] });
      toast({
        title: data.is_active ? 'Portal activado' : 'Portal desactivado',
        description: data.is_active 
          ? 'El cliente puede acceder al portal.' 
          : 'El cliente ya no puede acceder al portal.',
      });
    },
    onError: (error) => {
      console.error('Error toggling portal status:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado del portal.',
        variant: 'destructive',
      });
    },
  });
};

// ============= ADMIN: RESERVATIONS & LOGS =============

// Fetch all client reservations (admin view)
export const useAllClientReservations = (filters?: {
  clientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  return useQuery({
    queryKey: ['all-client-reservations', filters],
    queryFn: async () => {
      let query = supabase
        .from('client_reservations')
        .select(`
          *,
          properties (
            id,
            nombre,
            codigo,
            direccion,
            check_out_predeterminado
          ),
          clients (
            id,
            nombre
          )
        `)
        .order('created_at', { ascending: false });
      
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte('check_in_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('check_out_date', filters.dateTo);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map(item => ({
        id: item.id,
        clientId: item.client_id,
        propertyId: item.property_id,
        checkInDate: item.check_in_date,
        checkOutDate: item.check_out_date,
        guestCount: item.guest_count,
        specialRequests: item.special_requests,
        taskId: item.task_id,
        status: item.status as 'active' | 'cancelled' | 'completed',
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        property: item.properties ? {
          id: (item.properties as any).id,
          nombre: (item.properties as any).nombre,
          codigo: (item.properties as any).codigo,
          direccion: (item.properties as any).direccion,
          checkOutPredeterminado: (item.properties as any).check_out_predeterminado,
        } : undefined,
        clientName: (item.clients as any)?.nombre || 'Cliente desconocido',
      }));
    },
  });
};

// Fetch reservation logs (admin view)
export const useClientReservationLogs = (filters?: {
  clientId?: string;
  reservationId?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  return useQuery({
    queryKey: ['client-reservation-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('client_reservation_logs')
        .select(`
          *,
          clients (
            id,
            nombre
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.reservationId) {
        query = query.eq('reservation_id', filters.reservationId);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map(item => ({
        id: item.id,
        reservationId: item.reservation_id,
        clientId: item.client_id,
        action: item.action as 'created' | 'updated' | 'cancelled',
        oldData: item.old_data as Record<string, any> | null,
        newData: item.new_data as Record<string, any> | null,
        createdAt: item.created_at,
        clientName: (item.clients as any)?.nombre || 'Cliente desconocido',
      }));
    },
  });
};

// ============= PUBLIC PORTAL HOOKS =============

// Extract short_code from URL identifier (e.g., "client-name-abc12def" -> "abc12def")
export const extractShortCodeFromIdentifier = (identifier: string): string => {
  // The short_code is the last 8 characters after the last hyphen
  const parts = identifier.split('-');
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 8) {
      return lastPart;
    }
  }
  // Fallback: treat entire identifier as short_code or token
  return identifier;
};

// Verify portal by short_code and get client info
export const useVerifyPortalShortCode = (identifier: string | undefined) => {
  return useQuery({
    queryKey: ['portal-verify-shortcode', identifier],
    queryFn: async () => {
      if (!identifier) return null;
      
      const shortCode = extractShortCodeFromIdentifier(identifier);
      
      const { data, error } = await supabase
        .from('client_portal_access')
        .select(`
          *,
          clients (
            id,
            nombre
          )
        `)
        .eq('short_code', shortCode)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      return {
        portalAccess: {
          id: data.id,
          clientId: data.client_id,
          accessPin: data.access_pin,
          portalToken: data.portal_token,
          shortCode: data.short_code,
          isActive: data.is_active,
        },
        clientName: (data.clients as any)?.nombre || 'Cliente',
      };
    },
    enabled: !!identifier,
  });
};

// Legacy: Verify portal token (for backward compatibility)
export const useVerifyPortalToken = (token: string | undefined) => {
  return useQuery({
    queryKey: ['portal-verify-token', token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from('client_portal_access')
        .select(`
          *,
          clients (
            id,
            nombre
          )
        `)
        .eq('portal_token', token)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      return {
        portalAccess: {
          id: data.id,
          clientId: data.client_id,
          accessPin: data.access_pin,
          portalToken: data.portal_token,
          shortCode: data.short_code,
          isActive: data.is_active,
        },
        clientName: (data.clients as any)?.nombre || 'Cliente',
      };
    },
    enabled: !!token,
  });
};

// Authenticate with PIN (supports both short_code and legacy token)
export const useAuthenticatePortal = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ identifier, pin }: { identifier: string; pin: string }) => {
      const shortCode = extractShortCodeFromIdentifier(identifier);
      
      // Try short_code first
      let { data, error } = await supabase
        .from('client_portal_access')
        .select(`
          *,
          clients (
            id,
            nombre
          )
        `)
        .eq('short_code', shortCode)
        .eq('access_pin', pin)
        .eq('is_active', true)
        .maybeSingle();
      
      // Fallback to legacy portal_token if not found
      if (!data && !error) {
        const legacyResult = await supabase
          .from('client_portal_access')
          .select(`
            *,
            clients (
              id,
              nombre
            )
          `)
          .eq('portal_token', identifier)
          .eq('access_pin', pin)
          .eq('is_active', true)
          .maybeSingle();
        
        data = legacyResult.data;
        error = legacyResult.error;
      }
      
      if (error) throw error;
      if (!data) {
        throw new Error('PIN incorrecto');
      }
      
      // Update last access
      await supabase
        .from('client_portal_access')
        .update({ last_access_at: new Date().toISOString() })
        .eq('id', data.id);
      
      return {
        clientId: data.client_id,
        clientName: (data.clients as any)?.nombre || 'Cliente',
        portalToken: data.portal_token,
        shortCode: data.short_code,
      };
    },
  });
};

// Fetch client properties (for portal)
export const useClientProperties = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-properties', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('properties')
        .select('id, nombre, codigo, direccion, check_out_predeterminado, duracion_servicio')
        .eq('cliente_id', clientId)
        .or('is_active.eq.true,is_active.is.null')
        .order('nombre');
      
      if (error) throw error;
      
      return data.map(p => ({
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        direccion: p.direccion,
        checkOutPredeterminado: p.check_out_predeterminado,
        duracionServicio: p.duracion_servicio,
      }));
    },
    enabled: !!clientId,
  });
};

// Fetch client reservations (for portal)
export const useClientReservations = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-reservations', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('client_reservations')
        .select(`
          *,
          properties (
            id,
            nombre,
            codigo,
            direccion,
            check_out_predeterminado
          )
        `)
        .eq('client_id', clientId)
        .neq('status', 'cancelled')
        .order('check_in_date', { ascending: true });
      
      if (error) throw error;
      
      return data.map(item => ({
        id: item.id,
        clientId: item.client_id,
        propertyId: item.property_id,
        checkInDate: item.check_in_date,
        checkOutDate: item.check_out_date,
        guestCount: item.guest_count,
        specialRequests: item.special_requests,
        taskId: item.task_id,
        status: item.status as 'active' | 'cancelled' | 'completed',
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        property: item.properties ? {
          id: (item.properties as any).id,
          nombre: (item.properties as any).nombre,
          codigo: (item.properties as any).codigo,
          direccion: (item.properties as any).direccion,
          checkOutPredeterminado: (item.properties as any).check_out_predeterminado,
        } : undefined,
      })) as ClientReservation[];
    },
    enabled: !!clientId,
  });
};

// Create reservations (batch)
export const useCreateReservations = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      clientId, 
      reservations 
    }: { 
      clientId: string; 
      reservations: CreateReservationData[] 
    }) => {
      const results = [];
      
      for (const reservation of reservations) {
        // 1. Get property details for task creation
        const { data: property, error: propError } = await supabase
          .from('properties')
          .select('id, nombre, codigo, direccion, check_out_predeterminado, duracion_servicio, sede_id, cliente_id')
          .eq('id', reservation.propertyId)
          .single();
        
        if (propError) throw propError;
        
        // 2. Create the task for checkout day
        const checkoutTime = property.check_out_predeterminado || '11:00';
        const [hours, minutes] = checkoutTime.split(':').map(Number);
        const duration = property.duracion_servicio || 120;
        const totalMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(totalMinutes / 60);
        const endMinutes = totalMinutes % 60;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
        
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .insert([{
            property: property.nombre,
            address: property.direccion,
            date: reservation.checkOutDate,
            start_time: checkoutTime,
            end_time: endTime,
            type: 'mantenimiento-airbnb',
            status: 'pending',
            notes: reservation.specialRequests || null,
            propiedad_id: property.id,
            cliente_id: property.cliente_id,
            sede_id: property.sede_id,
            check_in: checkoutTime,
            check_out: checkoutTime,
          }])
          .select()
          .single();
        
        if (taskError) throw taskError;
        
        // 3. Create the reservation linked to the task
        const { data: reservationData, error: resError } = await supabase
          .from('client_reservations')
          .insert({
            client_id: clientId,
            property_id: reservation.propertyId,
            check_in_date: reservation.checkInDate,
            check_out_date: reservation.checkOutDate,
            guest_count: reservation.guestCount || null,
            special_requests: reservation.specialRequests || null,
            task_id: task.id,
            status: 'active',
          })
          .select()
          .single();
        
        if (resError) throw resError;
        
        // 4. Log the action
        await supabase
          .from('client_reservation_logs')
          .insert({
            reservation_id: reservationData.id,
            client_id: clientId,
            action: 'created',
            new_data: {
              propertyId: reservation.propertyId,
              propertyName: property.nombre,
              checkInDate: reservation.checkInDate,
              checkOutDate: reservation.checkOutDate,
              guestCount: reservation.guestCount,
              specialRequests: reservation.specialRequests,
              taskId: task.id,
            },
          });
        
        results.push(reservationData);
      }
      
      return results;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-reservations', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['all-client-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['client-reservation-logs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

// Update reservation
export const useUpdateReservation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      reservationId,
      clientId,
      updates 
    }: { 
      reservationId: string;
      clientId: string;
      updates: Partial<CreateReservationData>;
    }) => {
      // Get current reservation
      const { data: current, error: fetchError } = await supabase
        .from('client_reservations')
        .select('*, properties(nombre, check_out_predeterminado, duracion_servicio)')
        .eq('id', reservationId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update reservation
      const { data: updated, error: updateError } = await supabase
        .from('client_reservations')
        .update({
          property_id: updates.propertyId ?? current.property_id,
          check_in_date: updates.checkInDate ?? current.check_in_date,
          check_out_date: updates.checkOutDate ?? current.check_out_date,
          guest_count: updates.guestCount ?? current.guest_count,
          special_requests: updates.specialRequests ?? current.special_requests,
        })
        .eq('id', reservationId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      // If checkout date changed, update the task
      if (updates.checkOutDate && updates.checkOutDate !== current.check_out_date && current.task_id) {
        const property = current.properties as any;
        const checkoutTime = property?.check_out_predeterminado || '11:00';
        
        await supabase
          .from('tasks')
          .update({
            date: updates.checkOutDate,
            notes: updates.specialRequests ?? current.special_requests,
          })
          .eq('id', current.task_id);
      } else if (updates.specialRequests !== undefined && current.task_id) {
        // Update notes on task
        await supabase
          .from('tasks')
          .update({
            notes: updates.specialRequests,
          })
          .eq('id', current.task_id);
      }
      
      // Log the action
      await supabase
        .from('client_reservation_logs')
        .insert({
          reservation_id: reservationId,
          client_id: clientId,
          action: 'updated',
          old_data: {
            propertyId: current.property_id,
            checkInDate: current.check_in_date,
            checkOutDate: current.check_out_date,
            guestCount: current.guest_count,
            specialRequests: current.special_requests,
          },
          new_data: {
            propertyId: updates.propertyId ?? current.property_id,
            checkInDate: updates.checkInDate ?? current.check_in_date,
            checkOutDate: updates.checkOutDate ?? current.check_out_date,
            guestCount: updates.guestCount ?? current.guest_count,
            specialRequests: updates.specialRequests ?? current.special_requests,
          },
        });
      
      return updated;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-reservations', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['all-client-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['client-reservation-logs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

// Cancel reservation
export const useCancelReservation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      reservationId,
      clientId,
    }: { 
      reservationId: string;
      clientId: string;
    }) => {
      // Get current reservation
      const { data: current, error: fetchError } = await supabase
        .from('client_reservations')
        .select('*, properties(nombre)')
        .eq('id', reservationId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update reservation status
      const { data: updated, error: updateError } = await supabase
        .from('client_reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservationId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      // Delete the associated task
      if (current.task_id) {
        await supabase
          .from('tasks')
          .delete()
          .eq('id', current.task_id);
      }
      
      // Log the action
      await supabase
        .from('client_reservation_logs')
        .insert({
          reservation_id: reservationId,
          client_id: clientId,
          action: 'cancelled',
          old_data: {
            propertyId: current.property_id,
            propertyName: (current.properties as any)?.nombre,
            checkInDate: current.check_in_date,
            checkOutDate: current.check_out_date,
            guestCount: current.guest_count,
            specialRequests: current.special_requests,
            taskId: current.task_id,
          },
        });
      
      return updated;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-reservations', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['all-client-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['client-reservation-logs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};
