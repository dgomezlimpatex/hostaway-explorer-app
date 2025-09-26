import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  scheduleId?: string;
  scheduleName?: string;
  isRetry?: boolean;
  originalSyncId?: string;
}

const sendErrorNotification = async (supabase: any, error: any, scheduleName: string, retryAttempt: number) => {
  try {
    const { error: emailError } = await supabase.functions.invoke('send-sync-error-email', {
      body: {
        error: error.message || 'Error desconocido',
        scheduleName,
        retryAttempt,
        timestamp: new Date().toISOString()
      }
    });
    
    if (emailError) {
      console.error('Error enviando email de error:', emailError);
    } else {
      console.log('✅ Email de error enviado exitosamente');
    }
  } catch (emailError) {
    console.error('Error en sendErrorNotification:', emailError);
  }
};

const logError = async (supabase: any, syncLogId: string, scheduleId: string, error: any, retryAttempt: number) => {
  try {
    await supabase.from('hostaway_sync_errors').insert({
      sync_log_id: syncLogId,
      schedule_id: scheduleId,
      error_type: 'sync_failure',
      error_message: error.message || 'Error desconocido',
      error_details: {
        stack: error.stack,
        timestamp: new Date().toISOString()
      },
      retry_attempt: retryAttempt
    });
    console.log('✅ Error logged to database');
  } catch (logError) {
    console.error('❌ Error logging to database:', logError);
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  console.log('🚀 hostaway-sync-with-retry started');

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
    
    const requestBody: SyncRequest = await req.json().catch(() => ({}));
    const { scheduleId, scheduleName = 'Manual', isRetry = false, originalSyncId } = requestBody;

    console.log(`📋 Executing sync for schedule: ${scheduleName}, isRetry: ${isRetry}`);

    try {
      // Ejecutar la sincronización original
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('hostaway-sync', {
        body: {
          triggered_by: isRetry ? 'retry' : (scheduleId ? 'cron' : 'manual'),
          schedule_name: scheduleName,
          retry_attempt: isRetry ? 1 : 0,
          original_sync_id: originalSyncId
        }
      });

      if (syncError) {
        throw syncError;
      }

      console.log('✅ Sync completed successfully');
      
      return new Response(JSON.stringify({ 
        success: true, 
        data: syncResult,
        scheduleName,
        isRetry 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (firstError) {
      console.error('❌ First sync attempt failed:', firstError);

      if (isRetry) {
        // Si ya es un reintento y falló, notificar error y no reintentar más
        console.log('🚨 Retry also failed, sending error notification');
        
        if (scheduleId) {
          await sendErrorNotification(supabase, firstError, scheduleName, 1);
          await logError(supabase, '', scheduleId, firstError, 1);
        }

        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Sync failed after retry',
          details: firstError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Primer intento falló, esperar 5 minutos y reintentar
      console.log('⏳ Waiting 5 minutes before retry...');
      await delay(5 * 60 * 1000); // 5 minutos
      
      console.log('🔄 Starting retry attempt...');
      
      try {
        const { data: retryResult, error: retryError } = await supabase.functions.invoke('hostaway-sync', {
          body: {
            triggered_by: 'retry',
            schedule_name: scheduleName,
            retry_attempt: 1,
            original_sync_id: originalSyncId
          }
        });

        if (retryError) {
          throw retryError;
        }

        console.log('✅ Retry completed successfully');
        
        return new Response(JSON.stringify({ 
          success: true, 
          data: retryResult,
          scheduleName,
          wasRetried: true 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (retryError) {
        console.error('❌ Retry attempt also failed:', retryError);
        
        // Ambos intentos fallaron, enviar notificación de error
        if (scheduleId) {
          await sendErrorNotification(supabase, retryError, scheduleName, 1);
          await logError(supabase, '', scheduleId, retryError, 1);
        }

        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Sync failed after retry',
          firstError: firstError.message,
          retryError: retryError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

  } catch (error) {
    console.error('❌ Critical error in hostaway-sync-with-retry:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Critical error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});