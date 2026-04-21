import { SyncOrchestrator } from './sync-orchestrator.ts';
import { ResponseBuilder } from './response-builder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando sincronización con Avantio (modo background)...');

    const avantioApiToken = Deno.env.get('AVANTIO_API_TOKEN');

    if (!avantioApiToken) {
      console.log('⚠️ AVANTIO_API_TOKEN no configurado');
      return new Response(
        JSON.stringify(ResponseBuilder.buildConfigurationErrorResponse()),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const orchestrator = new SyncOrchestrator(supabaseUrl, supabaseServiceKey);

    // Initialize sync log SYNCHRONOUSLY so we can return its ID immediately
    await orchestrator.initializeSyncLog();
    const syncLogId = orchestrator.getSyncLogId();

    // Run the heavy work in the background — function returns immediately
    // EdgeRuntime.waitUntil keeps the worker alive until the promise settles
    // without blocking the HTTP response (avoids wall-clock + CPU limits on the request).
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions runtime
    EdgeRuntime.waitUntil((async () => {
      try {
        await orchestrator.performSync(avantioApiToken);
        await orchestrator.finalizeSyncLog(true);
        console.log('✅ Sincronización Avantio completada exitosamente (background)');
      } catch (error) {
        console.error('❌ Error durante la sincronización (background):', error);
        try {
          await orchestrator.finalizeSyncLog(false, error as Error);
        } catch (finalizeError) {
          console.error('❌ Error finalizando log:', finalizeError);
        }
      }
    })());

    // Return 202 Accepted with sync_log_id so the client can poll for status
    return new Response(
      JSON.stringify({
        success: true,
        status: 'running',
        message: 'Sincronización iniciada en segundo plano. Consulta avantio_sync_logs para ver el progreso.',
        sync_log_id: syncLogId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202
      }
    );

  } catch (error) {
    console.error('❌ Error crítico:', error);
    const response = ResponseBuilder.buildCriticalErrorResponse(error);
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
