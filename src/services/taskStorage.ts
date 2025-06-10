
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/calendar';

export const taskStorageService = {
  getTasks: async (): Promise<Task[]> => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      property: row.property,
      address: row.address,
      startTime: row.start_time,
      endTime: row.end_time,
      type: row.type,
      status: row.status as 'pending' | 'in-progress' | 'completed',
      checkOut: row.check_out,
      checkIn: row.check_in,
      cleaner: row.cleaner,
      backgroundColor: row.background_color,
      date: row.date,
      clienteId: row.cliente_id,
      propiedadId: row.propiedad_id,
      duracion: row.duracion,
      coste: row.coste,
      metodoPago: row.metodo_pago,
      supervisor: row.supervisor,
      cleanerId: row.cleaner_id
    })) || [];
  },

  createTask: async (task: Omit<Task, 'id'>): Promise<Task> => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        property: task.property,
        address: task.address,
        start_time: task.startTime,
        end_time: task.endTime,
        type: task.type,
        status: task.status,
        check_out: task.checkOut,
        check_in: task.checkIn,
        cleaner: task.cleaner,
        background_color: task.backgroundColor,
        date: task.date,
        cliente_id: task.clienteId,
        propiedad_id: task.propiedadId,
        duracion: task.duracion,
        coste: task.coste,
        metodo_pago: task.metodoPago,
        supervisor: task.supervisor,
        cleaner_id: task.cleanerId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    return {
      id: data.id,
      property: data.property,
      address: data.address,
      startTime: data.start_time,
      endTime: data.end_time,
      type: data.type,
      status: data.status as 'pending' | 'in-progress' | 'completed',
      checkOut: data.check_out,
      checkIn: data.check_in,
      cleaner: data.cleaner,
      backgroundColor: data.background_color,
      date: data.date,
      clienteId: data.cliente_id,
      propiedadId: data.propiedad_id,
      duracion: data.duracion,
      coste: data.coste,
      metodoPago: data.metodo_pago,
      supervisor: data.supervisor,
      cleanerId: data.cleaner_id
    };
  },

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<Task> => {
    const updateData: any = {};
    
    if (updates.property !== undefined) updateData.property = updates.property;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.checkOut !== undefined) updateData.check_out = updates.checkOut;
    if (updates.checkIn !== undefined) updateData.check_in = updates.checkIn;
    if (updates.cleaner !== undefined) updateData.cleaner = updates.cleaner;
    if (updates.backgroundColor !== undefined) updateData.background_color = updates.backgroundColor;
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.clienteId !== undefined) updateData.cliente_id = updates.clienteId;
    if (updates.propiedadId !== undefined) updateData.propiedad_id = updates.propiedadId;
    if (updates.duracion !== undefined) updateData.duracion = updates.duracion;
    if (updates.coste !== undefined) updateData.coste = updates.coste;
    if (updates.metodoPago !== undefined) updateData.metodo_pago = updates.metodoPago;
    if (updates.supervisor !== undefined) updateData.supervisor = updates.supervisor;
    if (updates.cleanerId !== undefined) updateData.cleaner_id = updates.cleanerId;

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }

    return {
      id: data.id,
      property: data.property,
      address: data.address,
      startTime: data.start_time,
      endTime: data.end_time,
      type: data.type,
      status: data.status as 'pending' | 'in-progress' | 'completed',
      checkOut: data.check_out,
      checkIn: data.check_in,
      cleaner: data.cleaner,
      backgroundColor: data.background_color,
      date: data.date,
      clienteId: data.cliente_id,
      propiedadId: data.propiedad_id,
      duracion: data.duracion,
      coste: data.coste,
      metodoPago: data.metodo_pago,
      supervisor: data.supervisor,
      cleanerId: data.cleaner_id
    };
  },

  deleteTask: async (taskId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }

    return true;
  },

  assignTask: async (taskId: string, cleanerName: string, cleanerId?: string): Promise<Task> => {
    console.log('assignTask called with:', { taskId, cleanerName, cleanerId });
    
    const updateData: any = { 
      cleaner: cleanerName,
      updated_at: new Date().toISOString()
    };
    
    if (cleanerId) {
      updateData.cleaner_id = cleanerId;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error assigning task:', error);
      throw error;
    }

    return {
      id: data.id,
      property: data.property,
      address: data.address,
      startTime: data.start_time,
      endTime: data.end_time,
      type: data.type,
      status: data.status as 'pending' | 'in-progress' | 'completed',
      checkOut: data.check_out,
      checkIn: data.check_in,
      cleaner: data.cleaner,
      backgroundColor: data.background_color,
      date: data.date,
      clienteId: data.cliente_id,
      propiedadId: data.propiedad_id,
      duracion: data.duracion,
      coste: data.coste,
      metodoPago: data.metodo_pago,
      supervisor: data.supervisor,
      cleanerId: data.cleaner_id
    };
  }
};
