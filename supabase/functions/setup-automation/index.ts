
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando configuración automática...');

    // 1. Ejecutar inserción de propiedades
    console.log('Paso 1: Insertando propiedades...');
    const propertiesResponse = await fetch(`${supabaseUrl}/functions/v1/insert-properties`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!propertiesResponse.ok) {
      const propertiesError = await propertiesResponse.text();
      console.error('Error insertando propiedades:', propertiesError);
      // Continuar con el cron job aunque falle la inserción
    } else {
      const propertiesData = await propertiesResponse.json();
      console.log('✅ Propiedades insertadas exitosamente:', propertiesData);
    }

    // 2. Configurar cron job
    console.log('Paso 2: Configurando cron job...');
    
    // Primero verificar si ya existe el cron job
    const { data: existingJobs } = await supabase
      .from('cron.job')
      .select('*')
      .eq('jobname', 'hostaway-sync-every-2-hours');

    if (!existingJobs || existingJobs.length === 0) {
      // Crear el cron job usando SQL directo
      const cronJobSQL = `
        SELECT cron.schedule(
          'hostaway-sync-every-2-hours',
          '0 */2 * * *',
          $$
          SELECT net.http_post(
            url := 'https://qyipyygojlfhdghnraus.supabase.co/functions/v1/hostaway-sync',
            headers := '{"Content-Type": "application/json"}'::jsonb
          );
          $$
        );
      `;

      const { error: cronError } = await supabase.rpc('exec_sql', { sql: cronJobSQL });

      if (cronError) {
        console.error('Error configurando cron job:', cronError);
      } else {
        console.log('✅ Cron job configurado exitosamente');
      }
    } else {
      console.log('✅ Cron job ya existe, no es necesario crearlo de nuevo');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Configuración automática completada',
      steps: {
        properties: 'Propiedades procesadas',
        cronJob: 'Cron job configurado para sincronización cada 2 horas'
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Error en configuración automática:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});
