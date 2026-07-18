export const HOSTAWAY_INTEGRATION_DISABLED = 'HOSTAWAY_INTEGRATION_DISABLED';

export function isHostawayIntegrationEnabled(): boolean {
  return false;
}

export function disabledHostawayResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      success: false,
      code: HOSTAWAY_INTEGRATION_DISABLED,
      error: 'La integración con Hostaway está desactivada y conservada para futuros clientes.',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
