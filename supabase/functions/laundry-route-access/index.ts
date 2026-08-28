import { createClient } from 'npm:@supabase/supabase-js@2.50.0';
import {
  getRouteLink,
  listActiveRouteWorkers,
  sha256,
  validateRouteSession,
} from '../_shared/laundryRouteAccess.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'list');
    const token = String(body.token ?? '').trim();
    const sessionToken = String(body.sessionToken ?? '').trim();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!token) return json({ error: 'Token requerido' }, 400);
    const linkResult = await getRouteLink(supabase, token);
    if ('error' in linkResult) return json({ error: linkResult.error }, linkResult.status);
    const { link } = linkResult;

    if (action === 'list') {
      const workers = await listActiveRouteWorkers(supabase, link.sede_id);
      return json({ success: true, required: workers.length > 0 });
    }

    if (action === 'validate') {
      const identity = await validateRouteSession(supabase, link.id, sessionToken);
      return identity
        ? json({ success: true, worker: identity })
        : json({ error: 'La sesion ha caducado', code: 'ROUTE_SESSION_REQUIRED' }, 401);
    }

    if (action === 'logout') {
      if (sessionToken) {
        await supabase
          .from('laundry_route_sessions')
          .update({ revoked_at: new Date().toISOString() })
          .eq('share_link_id', link.id)
          .eq('token_hash', await sha256(sessionToken));
      }
      return json({ success: true });
    }

    if (action !== 'login') return json({ error: 'Accion no valida' }, 400);

    const pin = String(body.pin ?? '').trim();
    if (!/^\d{3,12}$/.test(pin)) {
      return json({ error: 'Introduce un PIN valido' }, 400);
    }

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown')
      .split(',')[0]
      .trim();
    const ipFingerprint = await sha256(`${link.id}:${ip}`);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: failedAttempts, error: attemptsError } = await supabase
      .from('laundry_route_access_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('share_link_id', link.id)
      .eq('ip_fingerprint', ipFingerprint)
      .eq('successful', false)
      .gte('attempted_at', fifteenMinutesAgo);
    if (attemptsError) throw attemptsError;
    if ((failedAttempts ?? 0) >= 5) {
      return json({ error: 'Demasiados intentos. Espera 15 minutos antes de volver a probar.' }, 429);
    }

    const workers = await listActiveRouteWorkers(supabase, link.sede_id);
    const pinChecks = await Promise.all(workers.map(async (worker) => {
      const { data, error } = await supabase.rpc('verify_laundry_route_worker_pin', {
        _route_worker_id: worker.id,
        _pin: pin,
      });
      if (error) throw error;
      return data ? worker : null;
    }));
    const matchingWorkers = pinChecks.filter((worker) => worker !== null);
    const routeWorker = matchingWorkers.length === 1 ? matchingWorkers[0] : null;

    await supabase.from('laundry_route_access_attempts').insert({
      share_link_id: link.id,
      route_worker_id: routeWorker?.id ?? null,
      ip_fingerprint: ipFingerprint,
      successful: Boolean(routeWorker),
    });

    if (matchingWorkers.length > 1) {
      return json({ error: 'Este PIN esta duplicado. Contacta con el administrador.' }, 409);
    }
    if (!routeWorker) return json({ error: 'PIN incorrecto' }, 401);

    const rawSessionToken = randomToken();
    const twelveHours = Date.now() + 12 * 60 * 60 * 1000;
    const linkExpiry = link.expires_at ? new Date(link.expires_at).getTime() : twelveHours;
    const expiresAt = new Date(Math.min(twelveHours, linkExpiry)).toISOString();
    const { error: sessionError } = await supabase.from('laundry_route_sessions').insert({
      route_worker_id: routeWorker.id,
      share_link_id: link.id,
      token_hash: await sha256(rawSessionToken),
      expires_at: expiresAt,
    });
    if (sessionError) throw sessionError;

    const workerName = routeWorker.name;
    await Promise.all([
      supabase.from('laundry_route_workers').update({ last_access_at: new Date().toISOString() }).eq('id', routeWorker.id),
      supabase.from('laundry_route_worker_events').insert({
        share_link_id: link.id,
        route_worker_id: routeWorker.id,
        worker_name: workerName,
        action: 'login',
      }),
    ]);

    return json({
      success: true,
      sessionToken: rawSessionToken,
      expiresAt,
      worker: {
        routeWorkerId: routeWorker.id,
        cleanerId: routeWorker.cleanerId,
        workerName,
        sedeId: routeWorker.sedeId,
      },
    });
  } catch (error) {
    console.error('laundry-route-access error', error);
    return json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
});
