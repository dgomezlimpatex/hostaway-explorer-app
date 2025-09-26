
import { supabase } from "@/integrations/supabase/client";
import { HostawaySyncLog, TaskDetail, ReservationDetail } from "@/types/hostaway";
import { HostawaySchedule, CreateScheduleRequest, UpdateScheduleRequest } from "@/types/hostawaySchedule";

export const hostawaySync = {
  // Ejecutar inserción de propiedades
  async insertProperties() {
    console.log('Ejecutando inserción de propiedades...');
    
    const { data, error } = await supabase.functions.invoke('insert-properties');
    
    if (error) {
      console.error('Error en inserción de propiedades:', error);
      throw error;
    }
    
    return data;
  },

  // Configurar automatización completa (propiedades + cron job)
  async setupAutomation() {
    console.log('Ejecutando configuración automática...');
    
    const { data, error } = await supabase.functions.invoke('setup-automation');
    
    if (error) {
      console.error('Error en configuración automática:', error);
      throw error;
    }
    
    return data;
  },

  // Ejecutar sincronización manual
  async runSync() {
    console.log('Ejecutando sincronización manual con Hostaway...');
    
    const { data, error } = await supabase.functions.invoke('hostaway-sync');
    
    if (error) {
      console.error('Error en sincronización:', error);
      throw error;
    }
    
    return data;
  },

  // Eliminar todas las reservas de Hostaway
  async deleteAllHostawayReservations() {
    console.log('Eliminando todas las reservas de Hostaway...');
    
    const { error } = await supabase
      .from('hostaway_reservations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // This will delete all reservations

    if (error) {
      console.error('Error eliminando reservas de Hostaway:', error);
      throw error;
    }

    console.log('Todas las reservas de Hostaway eliminadas exitosamente');
    return true;
  },

  // Obtener logs de sincronización
  async getSyncLogs(limit = 10): Promise<HostawaySyncLog[]> {
    const { data, error } = await supabase
      .from('hostaway_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error obteniendo logs:', error);
      throw error;
    }
    
    // Transform the data to match our interface
    const transformedData: HostawaySyncLog[] = (data || []).map(log => {
      const logAny = log as any; // Cast to handle potential missing fields
      return {
        ...log,
        tasks_details: Array.isArray(log.tasks_details) ? log.tasks_details as unknown as TaskDetail[] : null,
        tasks_cancelled_details: Array.isArray(logAny.tasks_cancelled_details) ? logAny.tasks_cancelled_details as unknown as TaskDetail[] : null,
        tasks_modified_details: Array.isArray(logAny.tasks_modified_details) ? logAny.tasks_modified_details as unknown as TaskDetail[] : null,
        reservations_details: Array.isArray(log.reservations_details) ? log.reservations_details as unknown as ReservationDetail[] : null,
        // Ensure these fields are at least 0 if null or missing
        tasks_cancelled: logAny.tasks_cancelled || 0,
        tasks_modified: logAny.tasks_modified || 0,
      };
    });
    
    return transformedData;
  },

  // Obtener reservas de Hostaway
  async getHostawayReservations(limit = 50) {
    const { data, error } = await supabase
      .from('hostaway_reservations')
      .select(`
        *,
        properties:property_id(nombre, direccion),
        tasks:task_id(*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error obteniendo reservas:', error);
      throw error;
    }
    
    return data;
  },

  // Obtener estadísticas de sincronización
  async getSyncStats() {
    const { data: logs, error } = await supabase
      .from('hostaway_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
    
    const latestLog = logs?.[0];
    
    const { count: totalReservations } = await supabase
      .from('hostaway_reservations')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .not('cleaner_id', 'is', null);
    
    return {
      lastSync: latestLog?.sync_completed_at || null,
      lastSyncStatus: latestLog?.status || null,
      totalReservations: totalReservations || 0,
      activeTasks: activeTasks || 0,
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

  // ===== GESTIÓN DE HORARIOS =====

  // Obtener todos los horarios de sincronización
  async getSchedules(): Promise<HostawaySchedule[]> {
    const { data, error } = await supabase
      .from('hostaway_sync_schedules')
      .select('*')
      .order('hour', { ascending: true });
    
    if (error) {
      console.error('Error obteniendo horarios:', error);
      throw error;
    }
    
    return data || [];
  },

  // Crear nuevo horario
  async createSchedule(scheduleData: CreateScheduleRequest): Promise<HostawaySchedule> {
    const { data, error } = await supabase
      .from('hostaway_sync_schedules')
      .insert({
        ...scheduleData,
        timezone: scheduleData.timezone || 'Europe/Madrid',
        is_active: scheduleData.is_active ?? true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creando horario:', error);
      throw error;
    }
    
    // Reconfigurar cron jobs
    await this.setupCronJobs();
    
    return data;
  },

  // Actualizar horario existente
  async updateSchedule(id: string, updates: UpdateScheduleRequest): Promise<HostawaySchedule> {
    const { data, error } = await supabase
      .from('hostaway_sync_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error actualizando horario:', error);
      throw error;
    }
    
    // Reconfigurar cron jobs
    await this.setupCronJobs();
    
    return data;
  },

  // Eliminar horario
  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('hostaway_sync_schedules')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error eliminando horario:', error);
      throw error;
    }
    
    // Reconfigurar cron jobs
    await this.setupCronJobs();
  },

  // Configurar trabajos cron
  async setupCronJobs() {
    console.log('Configurando trabajos cron...');
    
    const { data, error } = await supabase.functions.invoke('manage-hostaway-cron', {
      body: { action: 'setup' }
    });
    
    if (error) {
      console.error('Error configurando cron jobs:', error);
      throw error;
    }
    
    return data;
  },

  // Ejecutar sincronización para un horario específico
  async runScheduledSync(scheduleId: string) {
    console.log('Ejecutando sincronización programada...');
    
    const { data, error } = await supabase.functions.invoke('manage-hostaway-cron', {
      body: { 
        action: 'sync',
        scheduleId 
      }
    });
    
    if (error) {
      console.error('Error en sincronización programada:', error);
      throw error;
    }
    
    return data;
  }
};
