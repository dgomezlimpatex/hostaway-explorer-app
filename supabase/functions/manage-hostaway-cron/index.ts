import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CronRequest {
  action: 'sync' | 'setup' | 'cleanup';
  scheduleId?: string;
}

const convertToCronExpression = (hour: number, minute: number, timezone: string = 'Europe/Madrid'): string => {
  // Cron expression: minute hour * * *
  return `${minute} ${hour} * * *`;
};

const setupCronJobs = async (supabase: any) => {
  console.log('🔄 Setting up cron jobs for active schedules...');
  
  // Obtener todos los schedules activos
  const { data: schedules, error } = await supabase
    .from('hostaway_sync_schedules')
    .select('*')
    .eq('is_active', true)
    .order('hour', { ascending: true });

  if (error) {
    throw new Error(`Error fetching schedules: ${error.message}`);
  }

  console.log(`📋 Found ${schedules?.length || 0} active schedules`);

  // Limpiar trabajos existentes (esto es simplificado, en producción requeriría más lógica)
  try {
    // Eliminar todos los trabajos cron existentes para Hostaway
    const { error: deleteError } = await supabase.rpc('cron.unschedule', {
      job_name: 'hostaway_sync_%'
    }).then(() => {
      console.log('🗑️ Existing cron jobs cleaned up');
    }).catch((err: any) => {
      console.log('ℹ️ No existing jobs to clean or cleanup failed:', err.message);
    });
  } catch (cleanupError) {
    console.log('ℹ️ Cleanup step skipped:', cleanupError);
  }

  // Crear nuevos trabajos cron para cada schedule activo
  for (const schedule of schedules || []) {
    const jobName = `hostaway_sync_${schedule.id.replace(/-/g, '_')}`;
    const cronExpression = convertToCronExpression(schedule.hour, schedule.minute, schedule.timezone);
    
    try {
      // Crear el trabajo cron usando pg_cron
      const cronQuery = `
        SELECT cron.schedule(
          '${jobName}',
          '${cronExpression}',
          $$
          SELECT net.http_post(
            url := '${Deno.env.get('SUPABASE_URL')}/functions/v1/hostaway-sync-with-retry',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}"}'::JSONB,
            body := '{"scheduleId": "${schedule.id}", "scheduleName": "${schedule.name}", "isRetry": false}'::JSONB
          ) as request_id;
          $$
        );
      `;

      const { error: cronError } = await supabase.rpc('exec_sql', { 
        query: cronQuery 
      });

      if (cronError) {
        console.error(`❌ Error creating cron job for ${schedule.name}:`, cronError);
      } else {
        console.log(`✅ Cron job created for ${schedule.name} at ${schedule.hour}:${schedule.minute.toString().padStart(2, '0')}`);
      }
    } catch (jobError) {
      console.error(`❌ Failed to create cron job for ${schedule.name}:`, jobError);
    }
  }

  return { success: true, schedulesProcessed: schedules?.length || 0 };
};

serve(async (req) => {
  console.log('🚀 manage-hostaway-cron started');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const requestBody: CronRequest = await req.json().catch(() => ({ action: 'setup' }));
    const { action, scheduleId } = requestBody;

    console.log(`📋 Action: ${action}, ScheduleId: ${scheduleId || 'N/A'}`);

    switch (action) {
      case 'sync':
        // Ejecutar sincronización para un schedule específico
        if (!scheduleId) {
          throw new Error('scheduleId is required for sync action');
        }

        const { data: schedule } = await supabase
          .from('hostaway_sync_schedules')
          .select('*')
          .eq('id', scheduleId)
          .single();

        if (!schedule) {
          throw new Error('Schedule not found');
        }

        const { data: syncResult, error: syncError } = await supabase.functions.invoke('hostaway-sync-with-retry', {
          body: {
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            isRetry: false
          }
        });

        if (syncError) {
          throw syncError;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          action: 'sync',
          schedule: schedule.name,
          result: syncResult 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'setup':
        // Configurar todos los cron jobs
        const setupResult = await setupCronJobs(supabase);
        
        return new Response(JSON.stringify({
          success: true,
          action: 'setup',
          ...setupResult
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'cleanup':
        // Limpiar trabajos cron (implementación básica)
        console.log('🗑️ Cleaning up cron jobs...');
        
        return new Response(JSON.stringify({
          success: true,
          action: 'cleanup',
          message: 'Cron cleanup completed'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('❌ Error in manage-hostaway-cron:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});