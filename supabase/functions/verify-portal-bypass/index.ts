// Validates a bypass token issued by admin-portal-bypass and returns the
// portal session (clientId, clientName, portalToken, shortCode) without PIN.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;

    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const enc = new TextEncoder();
    const data = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const expected = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expected)))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    if (expectedB64 !== sigB64) return null;

    const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded.padEnd(padded.length + (4 - padded.length % 4) % 4, '='));
    const payload = JSON.parse(json);

    if (payload.kind !== 'admin_portal_bypass') return null;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const bypassToken = body?.bypassToken as string | undefined;
    if (!bypassToken) {
      return json({ error: 'bypassToken required' }, 400);
    }

    const payload = await verifyToken(bypassToken);
    if (!payload) {
      return json({ error: 'Invalid or expired token' }, 401);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const clientId = payload.sub as string;
    const { data: client, error } = await admin
      .from('clients')
      .select('id, nombre')
      .eq('id', clientId)
      .maybeSingle();
    if (error) throw error;
    if (!client) return json({ error: 'Client not found' }, 404);

    return json({
      clientId: client.id,
      clientName: client.nombre,
      portalToken: payload.portal_token,
      shortCode: payload.short_code,
      isAdminBypass: true,
    });
  } catch (err) {
    console.error('verify-portal-bypass error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
