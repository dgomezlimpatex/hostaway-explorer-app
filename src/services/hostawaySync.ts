
import { supabase } from "@/integrations/supabase/client";

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

  // Configurar cron job
  async setupCronJob() {
    console.log('Configurando cron job para sincronización...');
    
    const { data, error } = await supabase.rpc('setup_hostaway_cron');
    
    if (error) {
      console.error('Error configurando cron job:', error);
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

  // Obtener logs de sincronización
  async getSyncLogs(limit = 10) {
    const { data, error } = await supabase
      .from('hostaway_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error obteniendo logs:', error);
      throw error;
    }
    
    return data;
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
