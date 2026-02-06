import { supabase } from "@/integrations/supabase/client";
import { AvantioSyncLog, TaskDetail, ReservationDetail, AvantioSchedule, AvantioSyncError, CreateScheduleRequest, UpdateScheduleRequest } from "@/types/avantio";

export const avantioSync = {
  // Ejecutar sincronización manual
  async runSync() {
    console.log('Ejecutando sincronización manual con Avantio...');
    const { data, error } = await supabase.functions.invoke('avantio-sync');
    if (error) {
      console.error('Error en sincronización:', error);
      throw error;
    }
    return data;
  },

  // Configurar automatización (cron jobs)
  async setupAutomation() {
    const { data, error } = await supabase.functions.invoke('manage-avantio-cron', {
      body: { action: 'setup' }
    });
    if (error) throw error;
    return data;
  },

  // Eliminar todas las reservas de Avantio
  async deleteAllAvantioReservations() {
    const { error } = await supabase
      .from('avantio_reservations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return true;
  },

  // Obtener logs de sincronización
  async getSyncLogs(limit = 10): Promise<AvantioSyncLog[]> {
    const { data, error } = await supabase
      .from('avantio_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    
    return (data || []).map(log => {
      const logAny = log as any;
      return {
        ...log,
        tasks_details: Array.isArray(log.tasks_details) ? log.tasks_details as unknown as TaskDetail[] : null,
        tasks_cancelled_details: Array.isArray(logAny.tasks_cancelled_details) ? logAny.tasks_cancelled_details as unknown as TaskDetail[] : null,
        tasks_modified_details: Array.isArray(logAny.tasks_modified_details) ? logAny.tasks_modified_details as unknown as TaskDetail[] : null,
        reservations_details: Array.isArray(log.reservations_details) ? log.reservations_details as unknown as ReservationDetail[] : null,
        tasks_cancelled: logAny.tasks_cancelled || 0,
        tasks_modified: logAny.tasks_modified || 0,
      };
    });
  },

  // Obtener reservas de Avantio
  async getAvantioReservations(limit = 50) {
    const { data, error } = await supabase
      .from('avantio_reservations')
      .select(`*, properties:property_id(nombre, direccion), tasks:task_id(*)`)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  // Obtener estadísticas de sincronización
  async getSyncStats() {
    const { data: logs, error } = await supabase
      .from('avantio_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    
    const latestLog = logs?.[0];
    
    const { count: totalReservations } = await supabase
      .from('avantio_reservations')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .not('cleaner_id', 'is', null);
    
    // Count unresolved errors
    const { count: unresolvedErrors } = await supabase
      .from('avantio_sync_errors')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false);
    
    return {
      lastSync: latestLog?.sync_completed_at || null,
      lastSyncStatus: latestLog?.status || null,
      totalReservations: totalReservations || 0,
      activeTasks: activeTasks || 0,
      unresolvedErrors: unresolvedErrors || 0,
      lastSyncStats: latestLog ? {
        reservationsProcessed: latestLog.reservations_processed,
        newReservations: latestLog.new_reservations,
        updatedReservations: latestLog.updated_reservations,
        cancelledReservations: latestLog.cancelled_reservations,
        tasksCreated: latestLog.tasks_created,
        errors: latestLog.errors
      } : null
    };
  },

  // ===== ERRORES =====

  // Obtener errores de sincronización
  async getSyncErrors(onlyUnresolved = true, limit = 50): Promise<AvantioSyncError[]> {
    let query = supabase
      .from('avantio_sync_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (onlyUnresolved) {
      query = query.eq('resolved', false);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as AvantioSyncError[];
  },

  // Marcar error como resuelto
  async resolveError(errorId: string) {
    const { error } = await supabase
      .from('avantio_sync_errors')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', errorId);
    if (error) throw error;
  },

  // Marcar todos los errores como resueltos
  async resolveAllErrors() {
    const { error } = await supabase
      .from('avantio_sync_errors')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('resolved', false);
    if (error) throw error;
  },

  // ===== HORARIOS =====

  async getSchedules(): Promise<AvantioSchedule[]> {
    const { data, error } = await supabase
      .from('avantio_sync_schedules')
      .select('*')
      .order('hour', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createSchedule(scheduleData: CreateScheduleRequest): Promise<AvantioSchedule> {
    const { data, error } = await supabase
      .from('avantio_sync_schedules')
      .insert({
        ...scheduleData,
        timezone: scheduleData.timezone || 'Europe/Madrid',
        is_active: scheduleData.is_active ?? true
      })
      .select()
      .single();
    if (error) throw error;
    await this.setupCronJobs();
    return data;
  },

  async updateSchedule(id: string, updates: UpdateScheduleRequest): Promise<AvantioSchedule> {
    const { data, error } = await supabase
      .from('avantio_sync_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await this.setupCronJobs();
    return data;
  },

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('avantio_sync_schedules')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await this.setupCronJobs();
  },

  async setupCronJobs() {
    const { data, error } = await supabase.functions.invoke('manage-avantio-cron', {
      body: { action: 'setup' }
    });
    if (error) throw error;
    return data;
  },

  async runScheduledSync(scheduleId: string) {
    const { data, error } = await supabase.functions.invoke('manage-avantio-cron', {
      body: { action: 'sync', scheduleId }
    });
    if (error) throw error;
    return data;
  }
};
