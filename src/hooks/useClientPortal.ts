
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ClientPortalAccess, 
  ClientReservation, 
  ClientReservationLog,
  CreateReservationData,
  PortalSession,
  PortalBooking,
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
        lastAdminAccessAt: data.last_admin_access_at,
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
        
        const taskId = crypto.randomUUID();

        const { error: taskError } = await supabase
          .from('tasks')
          .insert([{
            id: taskId,
            property: property.nombre,
            address: property.direccion,
            date: reservation.checkOutDate,
            start_time: checkoutTime,
            end_time: endTime,
            type: 'limpieza-turistica',
            status: 'pending',
            notes: reservation.specialRequests || null,
            propiedad_id: property.id,
            cliente_id: property.cliente_id,
            sede_id: property.sede_id,
            check_in: checkoutTime,
            check_out: checkoutTime,
          }]);
        
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
            task_id: taskId,
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
              taskId,
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
      clientName,
      updates 
    }: { 
      reservationId: string;
      clientId: string;
      clientName?: string;
      updates: Partial<CreateReservationData>;
    }) => {
      // Get current reservation with full property details
      const { data: current, error: fetchError } = await supabase
        .from('client_reservations')
        .select('*, properties(id, nombre, codigo, direccion, check_out_predeterminado, duracion_servicio, sede_id, cliente_id)')
        .eq('id', reservationId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const newPropertyId = updates.propertyId ?? current.property_id;
      const propertyChanged = updates.propertyId && updates.propertyId !== current.property_id;
      
      // Get new property details if property changed
      let property = current.properties as any;
      if (propertyChanged) {
        const { data: newProp, error: propErr } = await supabase
          .from('properties')
          .select('id, nombre, codigo, direccion, check_out_predeterminado, duracion_servicio, sede_id, cliente_id')
          .eq('id', updates.propertyId!)
          .single();
        if (propErr) throw propErr;
        property = newProp;
      }
      
      // Update reservation
      const { error: updateError } = await supabase
        .from('client_reservations')
        .update({
          property_id: newPropertyId,
          check_in_date: updates.checkInDate ?? current.check_in_date,
          check_out_date: updates.checkOutDate ?? current.check_out_date,
          guest_count: updates.guestCount ?? current.guest_count,
          special_requests: updates.specialRequests ?? current.special_requests,
        })
        .eq('id', reservationId);
      
      if (updateError) throw updateError;
      
      // Sync the task with the current reservation data
      const newCheckOutDate = updates.checkOutDate ?? current.check_out_date;
      const checkoutTime = property?.check_out_predeterminado || '11:00';
      const [hours, minutes] = checkoutTime.split(':').map(Number);
      const duration = property?.duracion_servicio || 120;
      const totalMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

      if (current.task_id) {
        // Update existing task
        const taskUpdates: Record<string, any> = {
          date: newCheckOutDate,
          notes: updates.specialRequests ?? current.special_requests,
          start_time: checkoutTime,
          end_time: endTime,
        };

        if (propertyChanged) {
          taskUpdates.property = property.nombre;
          taskUpdates.address = property.direccion;
          taskUpdates.propiedad_id = property.id;
          taskUpdates.cliente_id = property.cliente_id;
          taskUpdates.sede_id = property.sede_id;
        }
        
        const { data: updatedTasks, error: taskUpdateError } = await supabase
          .from('tasks')
          .update(taskUpdates)
          .eq('id', current.task_id)
          .select('id, date')
          .limit(1);
        
        if (taskUpdateError) {
          console.error('Error updating task from portal:', taskUpdateError);
          throw taskUpdateError;
        }

        if (!updatedTasks || updatedTasks.length === 0) {
          throw new Error('No se pudo actualizar la tarea vinculada en el calendario.');
        }
      } else {
        // Task was deleted externally — recreate it
        const newTaskId = crypto.randomUUID();
        const { error: taskCreateError } = await supabase
          .from('tasks')
          .insert([{
            id: newTaskId,
            property: property.nombre,
            address: property.direccion,
            date: newCheckOutDate,
            start_time: checkoutTime,
            end_time: endTime,
            type: 'limpieza-turistica',
            status: 'pending',
            notes: updates.specialRequests ?? current.special_requests ?? null,
            propiedad_id: property.id,
            cliente_id: property.cliente_id,
            sede_id: property.sede_id,
            check_in: checkoutTime,
            check_out: checkoutTime,
          }]);
        
        if (taskCreateError) throw taskCreateError;
        
        // Link the new task to the reservation
        await supabase
          .from('client_reservations')
          .update({ task_id: newTaskId })
          .eq('id', reservationId);
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
            propertyId: newPropertyId,
            checkInDate: updates.checkInDate ?? current.check_in_date,
            checkOutDate: updates.checkOutDate ?? current.check_out_date,
            guestCount: updates.guestCount ?? current.guest_count,
            specialRequests: updates.specialRequests ?? current.special_requests,
          },
        });
      
      // Send notification email (fire and forget)
      supabase.functions.invoke('send-portal-change-notification', {
        body: {
          action: 'updated',
          clientName: clientName || 'Cliente',
          propertyName: property?.nombre || 'Propiedad',
          checkInDate: updates.checkInDate ?? current.check_in_date,
          checkOutDate: updates.checkOutDate ?? current.check_out_date,
          oldCheckInDate: current.check_in_date,
          oldCheckOutDate: current.check_out_date,
          guestCount: updates.guestCount ?? current.guest_count,
          specialRequests: updates.specialRequests ?? current.special_requests,
        },
      }).catch(err => console.error('Notification error:', err));
      
      return { success: true };
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
      clientName,
    }: { 
      reservationId: string;
      clientId: string;
      clientName?: string;
    }) => {
      // Get current reservation
      const { data: current, error: fetchError } = await supabase
        .from('client_reservations')
        .select('*, properties(nombre)')
        .eq('id', reservationId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const propertyName = (current.properties as any)?.nombre || 'Propiedad';
      
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
            propertyName,
            checkInDate: current.check_in_date,
            checkOutDate: current.check_out_date,
            guestCount: current.guest_count,
            specialRequests: current.special_requests,
            taskId: current.task_id,
          },
        });
      
      // Send notification email (fire and forget)
      supabase.functions.invoke('send-portal-change-notification', {
        body: {
          action: 'cancelled',
          clientName: clientName || 'Cliente',
          propertyName,
          checkInDate: current.check_in_date,
          checkOutDate: current.check_out_date,
        },
      }).catch(err => console.error('Notification error:', err));
      
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

// ============= UNIFIED PORTAL BOOKINGS (manual + external tasks) =============

/**
 * Returns a unified list of "bookings" for the client portal:
 *  - Manual reservations created from the portal (with full check-in/out info, editable)
 *  - External tasks linked to the client (Avantio / Hostaway / recurring / batch / manual tasks)
 *    that are NOT already linked to a manual reservation (avoid duplicates).
 * External tasks are read-only.
 */
export const useClientPortalBookings = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ['client-portal-bookings', clientId],
    queryFn: async (): Promise<PortalBooking[]> => {
      if (!clientId) return [];

      // 1) Manual reservations (with property)
      const { data: reservations, error: rErr } = await supabase
        .from('client_reservations')
        .select(`
          *,
          properties (
            id, nombre, codigo, direccion, check_out_predeterminado
          )
        `)
        .eq('client_id', clientId)
        .neq('status', 'cancelled')
        .order('check_in_date', { ascending: true });

      if (rErr) throw rErr;

      const reservationTaskIds = new Set(
        (reservations ?? [])
          .map(r => r.task_id)
          .filter((id): id is string => !!id)
      );

      // 2) External tasks for this client (excluding cancelled)
      // Paginate to bypass Supabase's 1000-row default limit
      const PAGE_SIZE = 1000;
      let allTasks: any[] = [];
      let from = 0;
      // Safety cap: 20k rows max (~years of data)
      const MAX_ROWS = 20000;
      while (from < MAX_ROWS) {
        const { data: pageTasks, error: tErr } = await supabase
          .from('tasks')
          .select(`
            id, date, start_time, end_time, status, type, notes,
            property, address, propiedad_id, cliente_id,
            properties:propiedad_id (
              id, nombre, codigo, direccion, check_out_predeterminado
            )
          `)
          .eq('cliente_id', clientId)
          .neq('status', 'cancelled')
          .order('date', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (tErr) throw tErr;
        if (!pageTasks || pageTasks.length === 0) break;
        allTasks = allTasks.concat(pageTasks);
        if (pageTasks.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const tasks = allTasks;

      const manualBookings: PortalBooking[] = (reservations ?? []).map((r: any) => ({
        id: `res-${r.id}`,
        source: 'manual',
        isEditable: true,
        cleaningDate: r.check_out_date,
        checkInDate: r.check_in_date,
        checkOutDate: r.check_out_date,
        guestCount: r.guest_count,
        specialRequests: r.special_requests,
        status: r.status,
        taskId: r.task_id,
        reservationId: r.id,
        property: r.properties ? {
          id: r.properties.id,
          nombre: r.properties.nombre,
          codigo: r.properties.codigo,
          direccion: r.properties.direccion,
          checkOutPredeterminado: r.properties.check_out_predeterminado,
        } : undefined,
      }));

      const externalBookings: PortalBooking[] = (tasks ?? [])
        .filter((t: any) => !reservationTaskIds.has(t.id))
        .map((t: any) => ({
          id: `task-${t.id}`,
          source: 'external',
          isEditable: false,
          cleaningDate: t.date,
          checkInDate: null,
          checkOutDate: null,
          guestCount: null,
          specialRequests: t.notes ?? null,
          status: t.status,
          taskStatus: t.status,
          taskId: t.id,
          reservationId: null,
          property: t.properties ? {
            id: t.properties.id,
            nombre: t.properties.nombre,
            codigo: t.properties.codigo,
            direccion: t.properties.direccion,
            checkOutPredeterminado: t.properties.check_out_predeterminado,
          } : (t.property ? {
            id: t.propiedad_id ?? '',
            nombre: t.property,
            codigo: '',
            direccion: t.address ?? '',
          } : undefined),
        }));

      // Attach taskStatus to manual bookings as well, by fetching their tasks if linked
      const manualTaskIds = manualBookings
        .map(b => b.taskId)
        .filter((id): id is string => !!id);

      if (manualTaskIds.length > 0) {
        const { data: linkedTasks } = await supabase
          .from('tasks')
          .select('id, status')
          .in('id', manualTaskIds);
        const statusById = new Map((linkedTasks ?? []).map((t: any) => [t.id, t.status]));
        manualBookings.forEach(b => {
          if (b.taskId) b.taskStatus = statusById.get(b.taskId) ?? null;
        });
      }

      return [...manualBookings, ...externalBookings].sort(
        (a, b) => new Date(a.cleaningDate).getTime() - new Date(b.cleaningDate).getTime()
      );
    },
    enabled: !!clientId,
  });
};

/**
 * Fetch the (latest) task report + media for a given task, respecting the
 * client's photos_visible_to_client flag. RLS on the server enforces this too.
 * Returns:
 *  - status: 'not_ready' | 'photos_disabled' | 'ready'
 *  - media: TaskMedia[] (only when ready)
 */
export const useClientPortalTaskReport = (taskId: string | null | undefined, clientId?: string) => {
  return useQuery({
    queryKey: ['client-portal-task-report', taskId, clientId],
    queryFn: async () => {
      if (!taskId || !clientId) return { status: 'not_ready' as const, media: [] };

      // Check client-level photos_visible flag via secure RPC (works for anon portal)
      const { data: photosEnabled, error: flagErr } = await supabase
        .rpc('get_client_photos_visibility', { _client_id: clientId });

      if (flagErr) {
        console.error('Error fetching photo visibility flag:', flagErr);
        return { status: 'photos_disabled' as const, media: [] };
      }

      if (!photosEnabled) {
        return { status: 'photos_disabled' as const, media: [] };
      }

      // Fetch the latest completed report for this task
      const { data: report, error: repErr } = await supabase
        .from('task_reports')
        .select('id, overall_status, end_time, notes')
        .eq('task_id', taskId)
        .eq('overall_status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (repErr) throw repErr;
      if (!report) return { status: 'not_ready' as const, media: [] };

      const { data: media, error: medErr } = await supabase
        .from('task_media')
        .select('id, file_url, media_type, description, timestamp, checklist_item_id')
        .eq('task_report_id', report.id)
        .order('timestamp', { ascending: true });

      if (medErr) throw medErr;

      return {
        status: 'ready' as const,
        media: media ?? [],
        report,
      };
    },
    enabled: !!taskId && !!clientId,
    staleTime: 60 * 1000,
  });
};

// ============= ADMIN: photos visibility toggle =============

export const useToggleClientPhotosVisibility = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ clientId, enabled }: { clientId: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('clients')
        .update({ photos_visible_to_client: enabled })
        .eq('id', clientId)
        .select('id, photos_visible_to_client')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['admin-client-portals'] });
      toast({
        title: variables.enabled ? 'Fotos habilitadas' : 'Fotos deshabilitadas',
        description: variables.enabled
          ? 'El cliente podrá ver las fotos del reporte.'
          : 'El cliente ya no verá las fotos del reporte.',
      });
    },
    onError: (err) => {
      console.error('Toggle photos visibility error:', err);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la visibilidad de fotos.',
        variant: 'destructive',
      });
    },
  });
};

// ============= ADMIN: portals overview =============

/**
 * Returns ALL clients with their portal access state (if any) and photo flag,
 * for the admin "Portales de clientes" panel.
 */
export const useAdminClientPortals = () => {
  return useQuery({
    queryKey: ['admin-client-portals'],
    queryFn: async () => {
      const { data: clients, error: cErr } = await supabase
        .from('clients')
        .select('id, nombre, is_active, photos_visible_to_client')
        .order('nombre', { ascending: true });
      if (cErr) throw cErr;

      const { data: accesses, error: aErr } = await supabase
        .from('client_portal_access')
        .select('id, client_id, access_pin, portal_token, short_code, is_active, last_access_at, last_admin_access_at, created_at, updated_at');
      if (aErr) throw aErr;

      const accessByClient = new Map((accesses ?? []).map(a => [a.client_id, a]));

      return (clients ?? []).map(c => {
        const a = accessByClient.get(c.id);
        return {
          clientId: c.id,
          clientName: c.nombre,
          clientActive: c.is_active,
          photosVisibleToClient: !!c.photos_visible_to_client,
          access: a ? {
            id: a.id,
            accessPin: a.access_pin,
            portalToken: a.portal_token,
            shortCode: a.short_code,
            isActive: a.is_active,
            lastAccessAt: a.last_access_at,
            lastAdminAccessAt: a.last_admin_access_at,
            createdAt: a.created_at,
            updatedAt: a.updated_at,
          } : null,
        };
      });
    },
  });
};

