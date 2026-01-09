import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { useToast } from '@/hooks/use-toast';
import { addDays, subDays, startOfWeek, format, getDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DeliverySchedule {
  id: string;
  sedeId: string | null;
  dayOfWeek: number; // 0=Sunday, 1=Monday...6=Saturday
  name: string;
  collectionDays: number[]; // Days of week for collection (dirty laundry from these service days)
  isActive: boolean;
  sortOrder: number;
}

export interface DeliveryDayOption {
  schedule: DeliverySchedule;
  deliveryDate: Date;
  collectionDates: Date[]; // Dates to COLLECT dirty laundry from (services that happened these days)
  deliveryDates: Date[]; // Dates to DELIVER clean laundry for (services that will happen these days)
  label: string;
  description: string;
  deliveryDescription: string;
}

// Map database row to interface
const mapToSchedule = (row: any): DeliverySchedule => ({
  id: row.id,
  sedeId: row.sede_id,
  dayOfWeek: row.day_of_week,
  name: row.name,
  collectionDays: row.collection_days || [],
  isActive: row.is_active,
  sortOrder: row.sort_order,
});

// Day names in Spanish
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Hook to manage delivery schedule configuration
 */
export const useLaundryDeliverySchedule = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  // Fetch delivery schedules (sede-specific or global defaults)
  const { data: schedules, isLoading, error, refetch } = useQuery({
    queryKey: ['laundry-delivery-schedule', activeSede?.id],
    queryFn: async () => {
      // Get sede-specific or global (sede_id IS NULL) schedules
      const { data, error } = await supabase
        .from('laundry_delivery_schedule')
        .select('*')
        .or(`sede_id.is.null,sede_id.eq.${activeSede?.id || '00000000-0000-0000-0000-000000000000'}`)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Prefer sede-specific schedules over global ones
      const scheduleMap = new Map<number, DeliverySchedule>();
      (data || []).forEach(row => {
        const schedule = mapToSchedule(row);
        // If sede-specific exists, use it; otherwise use global
        if (schedule.sedeId === activeSede?.id || !scheduleMap.has(schedule.dayOfWeek)) {
          scheduleMap.set(schedule.dayOfWeek, schedule);
        }
        // Override with sede-specific
        if (schedule.sedeId === activeSede?.id) {
          scheduleMap.set(schedule.dayOfWeek, schedule);
        }
      });

      return Array.from(scheduleMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    enabled: true,
  });

  // Update a schedule
  const updateSchedule = useMutation({
    mutationFn: async (params: { id: string; collectionDays: number[]; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('laundry_delivery_schedule')
        .update({
          collection_days: params.collectionDays,
          is_active: params.isActive,
        })
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return mapToSchedule(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laundry-delivery-schedule'] });
      toast({
        title: 'Configuración guardada',
        description: 'El horario de reparto ha sido actualizado',
      });
    },
    onError: (error) => {
      console.error('Error updating schedule:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    },
  });

  // Create sede-specific schedule (override global)
  const createSedeSchedule = useMutation({
    mutationFn: async (params: { dayOfWeek: number; name: string; collectionDays: number[]; sortOrder: number }) => {
      if (!activeSede?.id) throw new Error('No hay sede activa');

      const { data, error } = await supabase
        .from('laundry_delivery_schedule')
        .insert({
          sede_id: activeSede.id,
          day_of_week: params.dayOfWeek,
          name: params.name,
          collection_days: params.collectionDays,
          sort_order: params.sortOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return mapToSchedule(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laundry-delivery-schedule'] });
    },
  });

  return {
    schedules,
    isLoading,
    error,
    refetch,
    updateSchedule,
    createSedeSchedule,
    DAY_NAMES,
  };
};

/**
 * Calculate delivery day options for the current/next week
 * 
 * Logic:
 * - collectionDates: Services that HAPPENED on these days -> we COLLECT dirty laundry from them
 * - deliveryDates: Services that WILL HAPPEN after the delivery day -> we DELIVER clean laundry for them
 * 
 * Example for Friday delivery:
 * - collectionDays configured as [3, 4] (Wed, Thu)
 * - We COLLECT dirty laundry from Wed+Thu services
 * - We DELIVER clean laundry FOR Sat+Sun services (the next delivery day's collection days)
 */
export const useDeliveryDayOptions = (weekOffset: number = 0) => {
  const { schedules, isLoading } = useLaundryDeliverySchedule();

  const options: DeliveryDayOption[] = [];

  if (schedules && schedules.length > 0) {
    const today = new Date();
    const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 }); // Monday start

    // Sort schedules by day of week for finding "next" delivery day
    const sortedSchedules = [...schedules].sort((a, b) => {
      // Convert to Monday=0 based for sorting
      const aDay = a.dayOfWeek === 0 ? 6 : a.dayOfWeek - 1;
      const bDay = b.dayOfWeek === 0 ? 6 : b.dayOfWeek - 1;
      return aDay - bDay;
    });

    sortedSchedules.forEach((schedule, idx) => {
      // Calculate the delivery date for this week
      let deliveryDate = addDays(weekStart, schedule.dayOfWeek === 0 ? 6 : schedule.dayOfWeek - 1);
      
      // === COLLECTION DATES (dirty laundry from past services) ===
      const collectionDates: Date[] = [];
      schedule.collectionDays.forEach(collectionDay => {
        // Find the most recent occurrence of that day before or on delivery day
        let daysBack = (schedule.dayOfWeek - collectionDay + 7) % 7;
        if (daysBack === 0) daysBack = 7; // Same day means previous week
        
        const collectionDate = subDays(deliveryDate, daysBack);
        collectionDates.push(collectionDate);
      });
      collectionDates.sort((a, b) => a.getTime() - b.getTime());

      // === DELIVERY DATES (clean laundry for future services) ===
      // Find the next delivery day's collection days - those are the services we're delivering FOR
      const nextScheduleIdx = (idx + 1) % sortedSchedules.length;
      const nextSchedule = sortedSchedules[nextScheduleIdx];
      
      const deliveryDates: Date[] = [];
      nextSchedule.collectionDays.forEach(nextCollectionDay => {
        // These days happen AFTER current delivery day
        let daysForward = (nextCollectionDay - schedule.dayOfWeek + 7) % 7;
        if (daysForward === 0) daysForward = 7; // Same day means next week
        
        const deliveryForDate = addDays(deliveryDate, daysForward);
        deliveryDates.push(deliveryForDate);
      });
      deliveryDates.sort((a, b) => a.getTime() - b.getTime());

      // Build label and descriptions
      const label = `${schedule.name} ${format(deliveryDate, 'd MMM', { locale: es })}`;
      
      const collectionDayNames = schedule.collectionDays
        .map(d => DAY_NAMES[d])
        .join(' + ');
      const description = `Recoge servicios de: ${collectionDayNames}`;
      
      const deliveryDayNames = nextSchedule.collectionDays
        .map(d => DAY_NAMES[d])
        .join(' + ');
      const deliveryDescription = `Entrega para: ${deliveryDayNames}`;

      options.push({
        schedule,
        deliveryDate,
        collectionDates,
        deliveryDates,
        label,
        description,
        deliveryDescription,
      });
    });
  }

  return {
    options,
    isLoading,
  };
};

/**
 * Calculate actual collection dates for a specific delivery date
 */
export const calculateCollectionDates = (
  deliveryDate: Date,
  schedule: DeliverySchedule
): Date[] => {
  const collectionDates: Date[] = [];
  
  schedule.collectionDays.forEach(collectionDay => {
    // Find the most recent occurrence of this day before delivery
    let daysBack = (getDay(deliveryDate) - collectionDay + 7) % 7;
    if (daysBack === 0) daysBack = 7; // Same day means previous week
    
    const collectionDate = subDays(deliveryDate, daysBack);
    collectionDates.push(collectionDate);
  });

  return collectionDates.sort((a, b) => a.getTime() - b.getTime());
};

/**
 * Format collection dates range for display
 */
export const formatCollectionDatesRange = (dates: Date[]): string => {
  if (dates.length === 0) return '';
  if (dates.length === 1) {
    return format(dates[0], "EEEE d 'de' MMMM", { locale: es });
  }
  
  const first = dates[0];
  const last = dates[dates.length - 1];
  
  return `${format(first, "EEE d", { locale: es })} - ${format(last, "EEE d MMM", { locale: es })}`;
};
