
import { supabase } from '@/integrations/supabase/client';
import { RecurringTask } from '@/types/recurring';
import { Task } from '@/types/calendar';

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
    const nextExecution = calculateNextExecution(taskData);
    
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
        frequency: taskData.frequency,
        interval_days: taskData.interval,
        days_of_week: taskData.daysOfWeek,
        day_of_month: taskData.dayOfMonth,
        start_date: taskData.startDate,
        end_date: taskData.endDate,
        is_active: taskData.isActive,
        next_execution: nextExecution,
        last_execution: taskData.lastExecution,
        sede_id: "00000000-0000-0000-0000-000000000000" // TODO: Get from sede context
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
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.clienteId !== undefined) updateData.cliente_id = updates.clienteId;
    if (updates.propiedadId !== undefined) updateData.propiedad_id = updates.propiedadId;
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

    const { data, error } = await supabase
      .from('recurring_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
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

  processRecurringTasks: async (): Promise<Task[]> => {
    // Get all active recurring tasks that need to be executed
    const { data: recurringTasks, error } = await supabase
      .from('recurring_tasks')
      .select('*')
      .eq('is_active', true)
      .lte('next_execution', new Date().toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching recurring tasks for processing:', error);
      throw error;
    }

    const generatedTasks: Task[] = [];

    for (const recurringTask of recurringTasks || []) {
      // Create a new task from the recurring task template
      const newTask: Omit<Task, 'id'> = {
        property: `${recurringTask.name}`, // You might want to get the actual property name
        address: 'Dirección desde propiedad', // You might want to get the actual address
        startTime: recurringTask.start_time,
        endTime: recurringTask.end_time,
        type: recurringTask.type,
        status: 'pending' as const,
        checkOut: recurringTask.check_out,
        checkIn: recurringTask.check_in,
        cleaner: recurringTask.cleaner,
        backgroundColor: '#3B82F6',
        date: recurringTask.next_execution,
        clienteId: recurringTask.cliente_id,
        propertyId: recurringTask.propiedad_id,
        duration: recurringTask.duracion,
        cost: recurringTask.coste,
        paymentMethod: recurringTask.metodo_pago,
        supervisor: recurringTask.supervisor,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Create the task
      const { data: createdTask, error: createError } = await supabase
        .from('tasks')
        .insert({
          property: newTask.property,
          address: newTask.address,
          start_time: newTask.startTime,
          end_time: newTask.endTime,
          type: newTask.type,
          status: newTask.status,
          check_out: newTask.checkOut,
          check_in: newTask.checkIn,
          cleaner: newTask.cleaner,
          background_color: newTask.backgroundColor,
          date: newTask.date,
          cliente_id: newTask.clienteId,
          propiedad_id: newTask.propertyId,
          duracion: newTask.duration,
          coste: newTask.cost,
          metodo_pago: newTask.paymentMethod,
          supervisor: newTask.supervisor,
          sede_id: "00000000-0000-0000-0000-000000000000" // TODO: Get from sede context
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating task from recurring template:', createError);
        continue;
      }

      generatedTasks.push({
        id: createdTask.id,
        property: createdTask.property,
        address: createdTask.address,
        startTime: createdTask.start_time,
        endTime: createdTask.end_time,
        type: createdTask.type,
        status: createdTask.status as 'pending' | 'in-progress' | 'completed',
        checkOut: createdTask.check_out,
        checkIn: createdTask.check_in,
        cleaner: createdTask.cleaner,
        backgroundColor: createdTask.background_color,
        date: createdTask.date,
        clienteId: createdTask.cliente_id,
        propertyId: createdTask.propiedad_id,
        duration: createdTask.duracion,
        cost: createdTask.coste,
        paymentMethod: createdTask.metodo_pago,
        supervisor: createdTask.supervisor,
        created_at: createdTask.created_at,
        updated_at: createdTask.updated_at
      });

      // Update the recurring task with new next execution date
      const nextExecution = calculateNextExecutionFromData({
        frequency: recurringTask.frequency as 'daily' | 'weekly' | 'monthly',
        interval: recurringTask.interval_days,
        daysOfWeek: recurringTask.days_of_week,
        dayOfMonth: recurringTask.day_of_month,
        startDate: recurringTask.start_date,
        endDate: recurringTask.end_date,
        lastExecution: recurringTask.next_execution
      });

      await supabase
        .from('recurring_tasks')
        .update({
          next_execution: nextExecution,
          last_execution: recurringTask.next_execution
        })
        .eq('id', recurringTask.id);
    }

    return generatedTasks;
  }
};

// Helper function to calculate next execution date
function calculateNextExecution(taskData: Partial<RecurringTask>): string {
  const today = new Date();
  const startDate = new Date(taskData.startDate || today.toISOString().split('T')[0]);
  
  if (startDate > today) {
    return startDate.toISOString().split('T')[0];
  }

  return calculateNextExecutionFromData({
    frequency: taskData.frequency!,
    interval: taskData.interval!,
    daysOfWeek: taskData.daysOfWeek,
    dayOfMonth: taskData.dayOfMonth,
    startDate: taskData.startDate!,
    endDate: taskData.endDate,
    lastExecution: today.toISOString().split('T')[0]
  });
}

function calculateNextExecutionFromData(data: {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek?: number[] | null;
  dayOfMonth?: number | null;
  startDate: string;
  endDate?: string | null;
  lastExecution: string;
}): string {
  const lastDate = new Date(data.lastExecution);
  let nextDate = new Date(lastDate);

  switch (data.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + data.interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (data.interval * 7));
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + data.interval);
      if (data.dayOfMonth) {
        nextDate.setDate(data.dayOfMonth);
      }
      break;
  }

  return nextDate.toISOString().split('T')[0];
}
