
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import {
  assertAdminManagerOrServiceRole,
  authorizationErrorResponse,
} from '../_shared/edgeAuthorization.ts';
import { disabledHostawayResponse, isHostawayIntegrationEnabled } from '../_shared/disabledIntegration.ts';

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

  if (!isHostawayIntegrationEnabled()) {
    return disabledHostawayResponse(corsHeaders);
  }

  try {
    await assertAdminManagerOrServiceRole(req, supabase, supabaseServiceKey);
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

    // La programación se gestiona mediante manage-hostaway-cron. Nunca se
    // devuelven ni se incrustan credenciales administrativas en respuestas.
    console.log('Paso 2: Automatización gestionada por manage-hostaway-cron');

    return new Response(JSON.stringify({
      success: true,
      message: 'Configuración automática completada',
      steps: {
        properties: propertiesResult,
        cronJob: {
          success: true,
          message: 'Gestiona los horarios desde la configuración Hostaway autorizada'
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
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
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
