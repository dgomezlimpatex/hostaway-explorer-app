
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const orchestrator = new SyncOrchestrator(supabaseUrl, supabaseServiceKey);

    try {
      // Inicializar log de sincronización
      await orchestrator.initializeSyncLog();

      // Realizar sincronización
      await orchestrator.performSync();

      // Finalizar con éxito
      await orchestrator.finalizeSyncLog(true);

      console.log('✅ Sincronización CORREGIDA completada exitosamente');
      console.log(`📊 Estadísticas finales:`, orchestrator.getStats());

      const stats = orchestrator.getStats();
      const cancellationSummary = orchestrator.getCancellationSummary();
      
      // Calcular fechas para la respuesta
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = ResponseBuilder.buildSuccessResponse(
        stats,
        cancellationSummary,
        startDate,
        endDate,
        stats.reservations_processed
      );

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } catch (error) {
      console.error('❌ Error durante la sincronización:', error);
      
      await orchestrator.finalizeSyncLog(false, error);

      const response = ResponseBuilder.buildErrorResponse(error, orchestrator.getStats());

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

  } catch (error) {
    console.error('❌ Error crítico:', error);
    
    const response = ResponseBuilder.buildCriticalErrorResponse(error);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
