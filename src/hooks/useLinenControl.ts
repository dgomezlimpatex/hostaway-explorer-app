import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { useMemo, useEffect } from 'react';
import { format } from 'date-fns';

export type LinenStatus = 'clean' | 'needs-linen' | 'overdue';

export interface PropertyLinenStatus {
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  buildingCode: string;
  clientName: string;
  status: LinenStatus;
  lastDelivery: {
    date: string;
    deliveredBy: string;
  } | null;
  nextCleaning: {
    date: string;
    time: string;
    cleanerName: string;
    taskId: string;
  } | null;
  cleaningStarted: boolean; // True if cleaning time has arrived
}

export interface LinenControlStats {
  total: number;
  clean: number;
  needsLinen: number;
  overdue: number;
}

export const useLinenControl = () => {
  const { activeSede, isInitialized } = useSede();
  const queryClient = useQueryClient();

  // Subscribe to real-time updates for laundry_delivery_tracking
  useEffect(() => {
    if (!activeSede?.id) return;

    const channel = supabase
      .channel('linen-control-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'laundry_delivery_tracking'
        },
        () => {
          // Invalidate tracking query to refresh data
          queryClient.invalidateQueries({ queryKey: ['linen-control-tracking', activeSede.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSede?.id, queryClient]);

  // Fetch all properties with their clients (including linen control and active settings)
  const { data: properties, isLoading: propertiesLoading } = useQuery({
    queryKey: ['linen-control-properties', activeSede?.id],
    queryFn: async () => {
      if (!activeSede?.id) return [];

      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          codigo,
          nombre,
          cliente_id,
          linen_control_enabled,
          is_active,
          clients (nombre, linen_control_enabled, is_active)
        `)
        .eq('sede_id', activeSede.id)
        .order('codigo', { ascending: true });

      if (error) throw error;
      
      // Filter properties based on linen control AND active settings:
      // Property settings: null = inherit from client, true/false = explicit override
      return (data || []).filter(property => {
        const clientEnabled = (property.clients as any)?.linen_control_enabled ?? false;
        const clientIsActive = (property.clients as any)?.is_active !== false;
        const propertyLinenOverride = property.linen_control_enabled;
        const propertyActiveOverride = property.is_active;
        
        // Check if property is effectively active
        const isEffectivelyActive = propertyActiveOverride !== null ? propertyActiveOverride : clientIsActive;
        if (!isEffectivelyActive) return false;
        
        // Check if linen control is enabled
        const isLinenEnabled = propertyLinenOverride !== null ? propertyLinenOverride : clientEnabled;
        return isLinenEnabled === true;
      });
    },
    enabled: isInitialized && !!activeSede?.id,
  });

  // Fetch tasks for the next 7 days to find upcoming cleanings
  const { data: upcomingTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['linen-control-tasks', activeSede?.id],
    queryFn: async () => {
      if (!activeSede?.id) return [];

      const today = format(new Date(), 'yyyy-MM-dd');
      const nextWeek = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          propiedad_id,
          date,
          start_time,
          cleaner,
          type,
          status
        `)
        .eq('sede_id', activeSede.id)
        .eq('type', 'mantenimiento-airbnb')
        .gte('date', today)
        .lte('date', nextWeek)
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: isInitialized && !!activeSede?.id,
  });

  // Fetch all laundry delivery tracking (delivered status only)
  const { data: deliveryTracking, isLoading: trackingLoading } = useQuery({
    queryKey: ['linen-control-tracking', activeSede?.id],
    queryFn: async () => {
      // Get all share links for this sede
      const { data: shareLinks, error: linksError } = await supabase
        .from('laundry_share_links')
        .select('id')
        .eq('sede_id', activeSede?.id);

      if (linksError) throw linksError;
      if (!shareLinks || shareLinks.length === 0) return [];

      const linkIds = shareLinks.map(l => l.id);

      const { data, error } = await supabase
        .from('laundry_delivery_tracking')
        .select(`
          id,
          task_id,
          status,
          delivered_at,
          delivered_by_name
        `)
        .in('share_link_id', linkIds)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: isInitialized && !!activeSede?.id,
    staleTime: 10000, // Refetch every 10 seconds
    refetchInterval: 30000, // Also refetch every 30 seconds as backup
  });

  // Fetch tasks to map task_id -> propiedad_id for delivery tracking
  const { data: allTasksForMapping, isLoading: mappingLoading } = useQuery({
    queryKey: ['linen-control-task-mapping', activeSede?.id],
    queryFn: async () => {
      if (!activeSede?.id) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select('id, propiedad_id, date, start_time')
        .eq('sede_id', activeSede.id);

      if (error) throw error;
      return data || [];
    },
    enabled: isInitialized && !!activeSede?.id,
  });

  // Calculate linen status for each property
  const propertyStatuses = useMemo((): PropertyLinenStatus[] => {
    if (!properties || !upcomingTasks || !deliveryTracking || !allTasksForMapping) {
      return [];
    }

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const currentTime = format(now, 'HH:mm');

    // Create a map of task_id -> task details
    const taskMap = new Map(allTasksForMapping.map(t => [t.id, t]));

    // Create a set of task_ids that have been delivered (the task ITSELF was delivered)
    const deliveredTaskIds = new Set(
      deliveryTracking.map(t => t.task_id)
    );

    // Create a map of propiedad_id -> last delivery (for general tracking)
    const lastDeliveryByProperty = new Map<string, { date: string; deliveredBy: string }>();
    
    for (const tracking of deliveryTracking) {
      const task = taskMap.get(tracking.task_id);
      if (!task || !task.propiedad_id) continue;

      const existing = lastDeliveryByProperty.get(task.propiedad_id);
      if (!existing || (tracking.delivered_at && tracking.delivered_at > (existing.date || ''))) {
        lastDeliveryByProperty.set(task.propiedad_id, {
          date: tracking.delivered_at || '',
          deliveredBy: tracking.delivered_by_name || 'Desconocido',
        });
      }
    }

    // Create a map of propiedad_id -> next cleaning (first upcoming task)
    const nextCleaningByProperty = new Map<string, {
      date: string;
      time: string;
      cleanerName: string;
      taskId: string;
    }>();

    for (const task of upcomingTasks) {
      if (!task.propiedad_id) continue;
      
      // Only store the first (earliest) cleaning for each property
      if (!nextCleaningByProperty.has(task.propiedad_id)) {
        nextCleaningByProperty.set(task.propiedad_id, {
          date: task.date,
          time: task.start_time,
          cleanerName: task.cleaner || 'Sin asignar',
          taskId: task.id,
        });
      }
    }

    return properties.map(property => {
      const lastDelivery = lastDeliveryByProperty.get(property.id) || null;
      const nextCleaning = nextCleaningByProperty.get(property.id) || null;

      // Extract building code from property code (e.g., "MD18" from "MD18.1")
      const buildingCode = property.codigo.split('.')[0] || property.codigo;

      // Determine if cleaning time has arrived
      let cleaningStarted = false;
      if (nextCleaning) {
        const isCleaningToday = nextCleaning.date === todayStr;
        const cleaningTimeArrived = isCleaningToday && nextCleaning.time <= currentTime;
        const cleaningInPast = nextCleaning.date < todayStr;
        cleaningStarted = cleaningTimeArrived || cleaningInPast;
      }

      // Determine status
      // KEY LOGIC:
      // 1. If the property has a next cleaning task and that task's linen has been delivered -> clean
      // 2. If there's no delivery ever -> needs-linen
      // 3. If cleaning started and no delivery for that specific task -> needs-linen/overdue
      let status: LinenStatus = 'clean';

      // First check: if next cleaning task exists and has been delivered via the system
      if (nextCleaning && deliveredTaskIds.has(nextCleaning.taskId)) {
        // The linen for the upcoming/current cleaning has been delivered
        status = 'clean';
      } else if (!lastDelivery) {
        // Never been a delivery tracked for this property
        status = 'needs-linen';
      } else if (nextCleaning && cleaningStarted) {
        // There's a cleaning that has started - check if delivery was for this task
        // If the specific task hasn't been delivered, it needs linen
        if (!deliveredTaskIds.has(nextCleaning.taskId)) {
          if (nextCleaning.date < todayStr) {
            status = 'overdue';
          } else {
            status = 'needs-linen';
          }
        }
      }

      return {
        propertyId: property.id,
        propertyCode: property.codigo,
        propertyName: property.nombre,
        buildingCode,
        clientName: (property.clients as any)?.nombre || 'Sin cliente',
        status,
        lastDelivery,
        nextCleaning,
        cleaningStarted,
      };
    });
  }, [properties, upcomingTasks, deliveryTracking, allTasksForMapping]);

  // Calculate stats
  const stats = useMemo((): LinenControlStats => {
    return {
      total: propertyStatuses.length,
      clean: propertyStatuses.filter(p => p.status === 'clean').length,
      needsLinen: propertyStatuses.filter(p => p.status === 'needs-linen').length,
      overdue: propertyStatuses.filter(p => p.status === 'overdue').length,
    };
  }, [propertyStatuses]);

  // Get properties that need attention (needs-linen or overdue)
  const alertProperties = useMemo(() => {
    return propertyStatuses.filter(p => p.status !== 'clean');
  }, [propertyStatuses]);

  const isLoading = propertiesLoading || tasksLoading || trackingLoading || mappingLoading;

  return {
    propertyStatuses,
    stats,
    alertProperties,
    isLoading,
  };
};
