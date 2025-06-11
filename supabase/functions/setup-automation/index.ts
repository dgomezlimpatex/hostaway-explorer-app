
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

    let propertiesResult = { success: false, message: 'Error desconocido' };
    if (propertiesResponse.ok) {
      propertiesResult = await propertiesResponse.json();
      console.log('✅ Propiedades procesadas exitosamente:', propertiesResult);
    } else {
      const propertiesError = await propertiesResponse.text();
      console.error('Error insertando propiedades:', propertiesError);
      propertiesResult = { success: false, message: propertiesError };
    }

    // 2. Información sobre el cron job (manual por ahora)
    console.log('Paso 2: Información sobre cron job...');
    const cronMessage = `
    Para configurar la sincronización automática cada 2 horas, necesitas:
    
    1. Ir al SQL Editor de Supabase: https://supabase.com/dashboard/project/qyipyygojlfhdghnraus/sql/new
    
    2. Ejecutar este comando SQL:
    
    SELECT cron.schedule(
      'hostaway-sync-every-2-hours',
      '0 */2 * * *',
      $$
      SELECT net.http_post(
        url := 'https://qyipyygojlfhdghnraus.supabase.co/functions/v1/hostaway-sync',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${supabaseServiceKey}"}'::jsonb
      );
      $$
    );
    
    Esto configurará la sincronización automática cada 2 horas.
    `;

    console.log('📋 Instrucciones del cron job preparadas');

    return new Response(JSON.stringify({
      success: true,
      message: 'Configuración automática completada',
      steps: {
        properties: propertiesResult,
        cronJob: {
          success: true,
          message: 'Instrucciones para configurar cron job preparadas',
          instructions: cronMessage
        }
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
