// Generates a short-lived bypass token so admins/managers can open a client
// portal without entering the PIN. Validates the caller's role server-side.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

// Sign with HMAC-SHA256 using SUPABASE_SERVICE_ROLE_KEY as the secret.
// We avoid requiring an extra PORTAL_BYPASS_SECRET so the admin doesn't have
// to provision a new secret manually.
async function signToken(payload: Record<string, unknown>): Promise<string> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const enc = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const data = `${b64(header)}.${b64(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sigB64}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify role admin or manager
    const { data: roles, error: rolesErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (rolesErr) throw rolesErr;

    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has('admin') && !roleSet.has('manager')) {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const clientId = body?.clientId as string | undefined;
    if (!clientId) return json({ error: 'clientId required' }, 400);

    // Get portal access for this client
    const { data: access, error: accErr } = await admin
      .from('client_portal_access')
      .select('id, client_id, portal_token, short_code, is_active, clients(nombre)')
      .eq('client_id', clientId)
      .maybeSingle();
    if (accErr) throw accErr;
    if (!access) return json({ error: 'Portal not found for this client' }, 404);
    if (!access.is_active) return json({ error: 'Portal is disabled' }, 400);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: clientId,
      portal_id: access.id,
      portal_token: access.portal_token,
      short_code: access.short_code,
      admin_user: userId,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      kind: 'admin_portal_bypass',
    };

    const bypassToken = await signToken(payload);

    // Audit: update last_admin_access_at
    await admin
      .from('client_portal_access')
      .update({ last_admin_access_at: new Date().toISOString() })
      .eq('id', access.id);

    // Fetch actor profile for log enrichment
    let actorName: string | null = null;
    let actorEmail: string | null = null;
    try {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .maybeSingle();
      actorName = (profile as any)?.full_name ?? null;
      actorEmail = (profile as any)?.email ?? null;
    } catch (_e) { /* non-blocking */ }

    // Audit log entry
    try {
      await admin.from('client_portal_access_logs').insert({
        client_id: clientId,
        portal_access_id: access.id,
        access_type: 'admin_bypass',
        actor_user_id: userId,
        actor_name: actorName,
        actor_email: actorEmail,
        user_agent: req.headers.get('user-agent') ?? null,
        ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
        metadata: { source: 'admin-portal-bypass' },
      });
    } catch (logErr) {
      console.error('Failed to write portal access log:', logErr);
    }

    return json({
      bypassToken,
      shortCode: access.short_code,
      portalToken: access.portal_token,
      clientId,
      clientName: (access as any).clients?.nombre || 'Cliente',
      expiresAt: payload.exp,
    });
  } catch (err) {
    console.error('admin-portal-bypass error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
