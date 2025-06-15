
import { supabase } from "@/integrations/supabase/client";
import { HostawaySyncLog, TaskDetail, ReservationDetail } from "@/types/hostaway";

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
    const transformedData: HostawaySyncLog[] = (data || []).map(log => ({
      ...log,
      tasks_details: Array.isArray(log.tasks_details) ? log.tasks_details as unknown as TaskDetail[] : null,
      reservations_details: Array.isArray(log.reservations_details) ? log.reservations_details as unknown as ReservationDetail[] : null,
    }));
    
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
    
    const { data: totalReservations } = await supabase
      .from('hostaway_reservations')
      .select('*', { count: 'exact', head: true });
    
    const { data: activeTasks } = await supabase
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
  }
};
