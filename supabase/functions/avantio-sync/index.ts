import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
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

    // Parse trigger metadata from request body (cron sends triggered_by/schedule_name)
    let triggerMeta: { triggered_by?: string; schedule_name?: string; schedule_id?: string; source?: string } = {};
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        const body = await req.json();
        if (body && typeof body === 'object') triggerMeta = body;
      }
    } catch (_) {
      // ignore body parse errors
    }

    // CONCURRENCY GUARD: refuse if there's already a running sync started <30 min ago.
    // Prevents cron + manual triggers from stacking and competing for CPU.
    const guardClient = createClient(supabaseUrl, supabaseServiceKey);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: runningSyncs } = await guardClient
      .from('avantio_sync_logs')
      .select('id, sync_started_at, triggered_by')
      .eq('status', 'running')
      .gte('sync_started_at', thirtyMinAgo)
      .order('sync_started_at', { ascending: false })
      .limit(1);

    if (runningSyncs && runningSyncs.length > 0) {
      const existing = runningSyncs[0];
      console.log(`⏸️ Sync rechazado: ya hay una sincronización en curso (id=${existing.id})`);
      return new Response(
        JSON.stringify({
          success: false,
          status: 'skipped',
          message: 'Ya hay una sincronización Avantio en curso. Espera a que termine antes de lanzar otra.',
          running_sync_id: existing.id,
          running_since: existing.sync_started_at,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409
        }
      );
    }

    const orchestrator = new SyncOrchestrator(supabaseUrl, supabaseServiceKey);

    // Initialize sync log SYNCHRONOUSLY so we can return its ID immediately
    await orchestrator.initializeSyncLog(triggerMeta);
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
