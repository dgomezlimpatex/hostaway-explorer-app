import { createClient } from 'npm:@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
    if (claimsError || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);

    const userId = String(claims.claims.sub);
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roles, error: rolesError } = await admin.from('user_roles').select('role').eq('user_id', userId);
    if (rolesError) throw rolesError;
    if (!(roles ?? []).some((row: { role: string }) => ['admin', 'manager'].includes(row.role))) {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'status');
    const cleanerId = String(body.cleanerId ?? '').trim();
    if (!cleanerId) return json({ error: 'cleanerId requerido' }, 400);

    const { data: cleaner, error: cleanerError } = await admin
      .from('cleaners')
      .select('id, name, sede_id, pin, is_active, external_id')
      .eq('id', cleanerId)
      .maybeSingle();
    if (cleanerError) throw cleanerError;
    if (!cleaner) return json({ error: 'Trabajador no encontrado' }, 404);

    const { data: existing, error: existingError } = await admin
      .from('laundry_route_workers')
      .select('id, is_active, last_access_at, pin_synced_at')
      .eq('cleaner_id', cleanerId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (action === 'status') {
      return json({
        success: true,
        access: existing ?? null,
        hasRegistroPin: Boolean(String(cleaner.pin ?? '').trim()),
        isLinkedToRegistro: Boolean(cleaner.external_id),
        workerIsActive: Boolean(cleaner.is_active),
      });
    }

    if (action !== 'set_active') return json({ error: 'Accion no valida' }, 400);
    const enabled = body.enabled === true;
    if (!enabled) {
      if (existing?.id) {
        await admin.from('laundry_route_workers').update({ is_active: false }).eq('id', existing.id);
        await admin.from('laundry_route_sessions').update({ revoked_at: new Date().toISOString() })
          .eq('route_worker_id', existing.id).is('revoked_at', null);
      }
      return json({ success: true, active: false });
    }

    if (!cleaner.is_active) return json({ error: 'Activa primero al trabajador' }, 409);
    const pin = String(cleaner.pin ?? '').trim();
    if (!pin) return json({ error: 'Este trabajador no tiene PIN en REGISTRO' }, 409);

    const { data: sameSedeWorkers, error: duplicateError } = await admin
      .from('laundry_route_workers')
      .select('cleaner_id, cleaners!inner(pin)')
      .eq('sede_id', cleaner.sede_id)
      .eq('is_active', true)
      .neq('cleaner_id', cleaner.id);
    if (duplicateError) throw duplicateError;
    if ((sameSedeWorkers ?? []).some((row: any) => String(row.cleaners?.pin ?? '').trim() === pin)) {
      return json({ error: 'Hay otro repartidor activo con el mismo PIN en esta sede' }, 409);
    }

    const { data: access, error: upsertError } = await admin
      .from('laundry_route_workers')
      .upsert({
        cleaner_id: cleaner.id,
        sede_id: cleaner.sede_id,
        is_active: true,
        created_by: userId,
      }, { onConflict: 'cleaner_id' })
      .select('id, is_active, last_access_at, pin_synced_at')
      .single();
    if (upsertError) throw upsertError;
    return json({ success: true, active: true, access });
  } catch (error) {
    console.error('manage-laundry-route-workers error', error);
    return json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
});
