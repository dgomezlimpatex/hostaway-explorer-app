import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { action, scheduleId } = await req.json();
    
    console.log(`🔧 Acción solicitada: ${action}`);

    switch (action) {
      case 'setup':
        return await setupCronJobs(supabase, supabaseUrl, supabaseAnonKey, corsHeaders);
      
      case 'list':
        return await listCronJobs(supabase, corsHeaders);
      
      case 'delete':
        return await deleteCronJob(supabase, scheduleId, corsHeaders);
      
      case 'sync':
        return await runSync(supabase, scheduleId, corsHeaders);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Acción no válida', validActions: ['setup', 'list', 'delete', 'sync'] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Error en manage-avantio-cron:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function setupCronJobs(supabase: any, supabaseUrl: string, supabaseAnonKey: string, corsHeaders: any) {
  console.log('🔧 Configurando cron jobs de Avantio...');
  
  // Obtener horarios activos
  const { data: schedules, error: schedulesError } = await supabase
    .from('avantio_sync_schedules')
    .select('*')
    .eq('is_active', true)
    .order('hour', { ascending: true });
  
  if (schedulesError) {
    throw new Error(`Error obteniendo horarios: ${schedulesError.message}`);
  }
  
  if (!schedules || schedules.length === 0) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'No hay horarios activos configurados',
        jobsCreated: 0 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const functionUrl = `${supabaseUrl}/functions/v1/avantio-sync`;
  const authHeader = JSON.stringify({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`
  });
  
  const results = [];
  
  for (const schedule of schedules) {
    // Convertir hora local a UTC para el cron
    const cronSchedule = `${schedule.minute} ${schedule.hour} * * *`;
    const jobName = `avantio_sync_${schedule.id.substring(0, 8)}`;
    const requestBody = JSON.stringify({ 
      triggered_by: 'scheduled',
      schedule_id: schedule.id,
      schedule_name: schedule.name
    });
    
    console.log(`📅 Configurando: ${schedule.name} (${schedule.hour}:${schedule.minute.toString().padStart(2, '0')})`);
    
    // Usar la función de base de datos para crear el cron job
    const { data, error } = await supabase.rpc('manage_avantio_cron_job', {
      job_name: jobName,
      cron_schedule: cronSchedule,
      function_url: functionUrl,
      auth_header: authHeader,
      request_body: requestBody
    });
    
    if (error) {
      console.error(`❌ Error creando job ${jobName}:`, error);
      results.push({ schedule: schedule.name, success: false, error: error.message });
    } else {
      console.log(`✅ Job creado: ${jobName}`);
      results.push({ schedule: schedule.name, success: true, jobName, data });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  
  return new Response(
    JSON.stringify({
      success: true,
      message: `${successCount} de ${schedules.length} cron jobs configurados`,
      jobsCreated: successCount,
      details: results
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function listCronJobs(supabase: any, corsHeaders: any) {
  console.log('📋 Listando cron jobs de Avantio...');
  
  const { data, error } = await supabase.rpc('list_avantio_cron_jobs');
  
  if (error) {
    throw new Error(`Error listando jobs: ${error.message}`);
  }
  
  return new Response(
    JSON.stringify({ success: true, jobs: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function deleteCronJob(supabase: any, scheduleId: string, corsHeaders: any) {
  if (!scheduleId) {
    return new Response(
      JSON.stringify({ error: 'scheduleId es requerido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
  
  const jobName = `avantio_sync_${scheduleId.substring(0, 8)}`;
  console.log(`🗑️ Eliminando cron job: ${jobName}`);
  
  const { data, error } = await supabase.rpc('delete_avantio_cron_job', {
    job_name: jobName
  });
  
  if (error) {
    throw new Error(`Error eliminando job: ${error.message}`);
  }
  
  return new Response(
    JSON.stringify({ success: true, message: `Job ${jobName} eliminado`, data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function runSync(supabase: any, scheduleId: string, corsHeaders: any) {
  console.log('🔄 Ejecutando sincronización manual...');
  
  // Invocar la función de sincronización directamente
  const { data, error } = await supabase.functions.invoke('avantio-sync', {
    body: { 
      triggered_by: scheduleId ? 'scheduled' : 'manual',
      schedule_id: scheduleId
    }
  });
  
  if (error) {
    throw new Error(`Error en sincronización: ${error.message}`);
  }
  
  return new Response(
    JSON.stringify({ success: true, syncResult: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
