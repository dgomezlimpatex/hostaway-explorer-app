
import { supabase } from '@/integrations/supabase/client';
import { RecurringTask } from '@/types/recurring';
import {
  calculateInitialExecution,
  calculateNextExecution,
  getMadridDateKey,
} from '../../supabase/functions/_shared/recurringSchedule';

// Helper function to get sede_id from context or throw error
const getSedeId = (): string => {
  // Try to get from localStorage as fallback
  const activeSedeId = localStorage.getItem('activeSede');
  if (activeSedeId) {
    try {
      const sede = JSON.parse(activeSedeId);
      return sede.id;
    } catch {
      // If parsing fails, fallback
    }
  }
  throw new Error('No hay sede activa disponible para crear la tarea recurrente');
};

export const recurringTaskStorage = {
  getAll: async (): Promise<RecurringTask[]> => {
    const { data, error } = await supabase
      .from('recurring_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recurring tasks:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      clienteId: row.cliente_id,
      propiedadId: row.propiedad_id,
      cleanerId: row.cleaner_id,
      type: row.type,
      startTime: row.start_time,
      endTime: row.end_time,
      checkOut: row.check_out,
      checkIn: row.check_in,
      duracion: row.duracion,
      coste: row.coste,
      metodoPago: row.metodo_pago,
      supervisor: row.supervisor,
      cleaner: row.cleaner,
      frequency: row.frequency as 'daily' | 'weekly' | 'monthly',
      interval: row.interval_days,
      daysOfWeek: row.days_of_week,
      dayOfMonth: row.day_of_month,
      startDate: row.start_date,
      endDate: row.end_date,
      isActive: row.is_active,
      nextExecution: row.next_execution,
      lastExecution: row.last_execution,
      createdAt: row.created_at
    })) || [];
  },

  getById: async (id: string): Promise<RecurringTask | undefined> => {
    const { data, error } = await supabase
      .from('recurring_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined; // No data found
      }
      console.error('Error fetching recurring task:', error);
      throw error;
    }

    if (!data) return undefined;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      clienteId: data.cliente_id,
      propiedadId: data.propiedad_id,
      cleanerId: data.cleaner_id,
      type: data.type,
      startTime: data.start_time,
      endTime: data.end_time,
      checkOut: data.check_out,
      checkIn: data.check_in,
      duracion: data.duracion,
      coste: data.coste,
      metodoPago: data.metodo_pago,
      supervisor: data.supervisor,
      cleaner: data.cleaner,
      frequency: data.frequency as 'daily' | 'weekly' | 'monthly',
      interval: data.interval_days,
      daysOfWeek: data.days_of_week,
      dayOfMonth: data.day_of_month,
      startDate: data.start_date,
      endDate: data.end_date,
      isActive: data.is_active,
      nextExecution: data.next_execution,
      lastExecution: data.last_execution,
      createdAt: data.created_at
    };
  },

  create: async (taskData: Omit<RecurringTask, 'id' | 'createdAt' | 'nextExecution'>): Promise<RecurringTask> => {
    // Calculate next execution date
    const nextExecution = calculateInitialExecution({
      frequency: taskData.frequency,
      interval_days: taskData.interval,
      days_of_week: taskData.daysOfWeek,
      day_of_month: taskData.dayOfMonth,
      start_date: taskData.startDate,
      end_date: taskData.endDate,
    }, getMadridDateKey());
    if (!nextExecution) {
      throw new Error('La recurrencia no tiene ninguna ejecución válida dentro del rango de fechas');
    }
    
    const { data, error } = await supabase
      .from('recurring_tasks')
      .insert({
        name: taskData.name,
        description: taskData.description,
        cliente_id: taskData.clienteId,
        propiedad_id: taskData.propiedadId,
        type: taskData.type,
        start_time: taskData.startTime,
        end_time: taskData.endTime,
        check_out: taskData.checkOut,
        check_in: taskData.checkIn,
        duracion: taskData.duracion,
        coste: taskData.coste,
        metodo_pago: taskData.metodoPago,
        supervisor: taskData.supervisor,
        cleaner: taskData.cleaner,
        cleaner_id: taskData.cleanerId,
        frequency: taskData.frequency,
        interval_days: taskData.interval,
        days_of_week: taskData.daysOfWeek,
        day_of_month: taskData.dayOfMonth,
        start_date: taskData.startDate,
        end_date: taskData.endDate,
        is_active: taskData.isActive,
        next_execution: nextExecution,
        last_execution: taskData.lastExecution,
        sede_id: getSedeId()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating recurring task:', error);
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      clienteId: data.cliente_id,
      propiedadId: data.propiedad_id,
      cleanerId: data.cleaner_id,
      type: data.type,
      startTime: data.start_time,
      endTime: data.end_time,
      checkOut: data.check_out,
      checkIn: data.check_in,
      duracion: data.duracion,
      coste: data.coste,
      metodoPago: data.metodo_pago,
      supervisor: data.supervisor,
      cleaner: data.cleaner,
      frequency: data.frequency as 'daily' | 'weekly' | 'monthly',
      interval: data.interval_days,
      daysOfWeek: data.days_of_week,
      dayOfMonth: data.day_of_month,
      startDate: data.start_date,
      endDate: data.end_date,
      isActive: data.is_active,
      nextExecution: data.next_execution,
      lastExecution: data.last_execution,
      createdAt: data.created_at
    };
  },

  update: async (id: string, updates: Partial<RecurringTask>): Promise<RecurringTask | null> => {
    const updateData: any = {};

    const scheduleChanged = [
      'frequency',
      'interval',
      'daysOfWeek',
      'dayOfMonth',
      'startDate',
      'endDate',
    ].some((field) => updates[field as keyof RecurringTask] !== undefined);
    const recurringStateChanged = scheduleChanged
      || updates.isActive !== undefined
      || updates.nextExecution !== undefined
      || updates.lastExecution !== undefined;
    const shouldRecalculateSchedule = (scheduleChanged || updates.isActive === true)
      && updates.isActive !== false
      && updates.nextExecution === undefined;

    let currentData: any = null;
    if (recurringStateChanged) {
      const { data: current, error: currentError } = await supabase
        .from('recurring_tasks')
        .select('frequency, interval_days, days_of_week, day_of_month, start_date, end_date, last_execution, state_revision')
        .eq('id', id)
        .single();
      if (currentError) {
        if (currentError.code === 'PGRST116') return null;
        throw currentError;
      }
      currentData = current;
    }
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.clienteId !== undefined) updateData.cliente_id = updates.clienteId;
    if (updates.propiedadId !== undefined) updateData.propiedad_id = updates.propiedadId;
    if (updates.cleanerId !== undefined) updateData.cleaner_id = updates.cleanerId;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
    if (updates.checkOut !== undefined) updateData.check_out = updates.checkOut;
    if (updates.checkIn !== undefined) updateData.check_in = updates.checkIn;
    if (updates.duracion !== undefined) updateData.duracion = updates.duracion;
    if (updates.coste !== undefined) updateData.coste = updates.coste;
    if (updates.metodoPago !== undefined) updateData.metodo_pago = updates.metodoPago;
    if (updates.supervisor !== undefined) updateData.supervisor = updates.supervisor;
    if (updates.cleaner !== undefined) updateData.cleaner = updates.cleaner;
    if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
    if (updates.interval !== undefined) updateData.interval_days = updates.interval;
    if (updates.daysOfWeek !== undefined) updateData.days_of_week = updates.daysOfWeek;
    if (updates.dayOfMonth !== undefined) updateData.day_of_month = updates.dayOfMonth;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.nextExecution !== undefined) updateData.next_execution = updates.nextExecution;
    if (updates.lastExecution !== undefined) updateData.last_execution = updates.lastExecution;

    if (shouldRecalculateSchedule && currentData) {
      const mergedSchedule = {
        frequency: updates.frequency !== undefined ? updates.frequency : currentData.frequency,
        interval_days: updates.interval !== undefined ? updates.interval : currentData.interval_days,
        days_of_week: updates.daysOfWeek !== undefined ? updates.daysOfWeek : currentData.days_of_week,
        day_of_month: updates.dayOfMonth !== undefined ? updates.dayOfMonth : currentData.day_of_month,
        start_date: updates.startDate !== undefined ? updates.startDate : currentData.start_date,
        end_date: updates.endDate !== undefined ? updates.endDate : currentData.end_date,
      };
      const todayMadrid = getMadridDateKey();
      let nextExecution = calculateInitialExecution(mergedSchedule, todayMadrid);
      if (
        nextExecution
        && currentData.last_execution
        && nextExecution <= currentData.last_execution
      ) {
        nextExecution = calculateNextExecution(mergedSchedule, currentData.last_execution);
      }

      updateData.next_execution = nextExecution ?? '2099-12-31';
      updateData.is_active = nextExecution !== null;
    }

    let updateQuery = supabase
      .from('recurring_tasks')
      .update(updateData)
      .eq('id', id);

    if (currentData) {
      updateQuery = updateQuery.eq('state_revision', currentData.state_revision);
    }

    const { data, error } = await updateQuery
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        if (currentData) {
          throw new Error('La recurrencia cambió mientras se editaba. Recarga y vuelve a intentarlo.');
        }
        return null; // No data found
      }
      console.error('Error updating recurring task:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      clienteId: data.cliente_id,
      propiedadId: data.propiedad_id,
      cleanerId: data.cleaner_id,
      type: data.type,
      startTime: data.start_time,
      endTime: data.end_time,
      checkOut: data.check_out,
      checkIn: data.check_in,
      duracion: data.duracion,
      coste: data.coste,
      metodoPago: data.metodo_pago,
      supervisor: data.supervisor,
      cleaner: data.cleaner,
      frequency: data.frequency as 'daily' | 'weekly' | 'monthly',
      interval: data.interval_days,
      daysOfWeek: data.days_of_week,
      dayOfMonth: data.day_of_month,
      startDate: data.start_date,
      endDate: data.end_date,
      isActive: data.is_active,
      nextExecution: data.next_execution,
      lastExecution: data.last_execution,
      createdAt: data.created_at
    };
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('recurring_tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting recurring task:', error);
      throw error;
    }

    return true;
  },
};
