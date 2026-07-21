import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import {
  assertAdminManagerOrServiceRole,
  authorizationErrorResponse,
} from '../_shared/edgeAuthorization.ts';

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
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);
    const actor = await assertAdminManagerOrServiceRole(req, supabase, serviceRoleKey);
    if (actor.kind !== 'user' || !actor.userId) {
      return json({ success: false, error: 'Se requiere una sesión de usuario admin/manager' }, 403);
    }

    const body = await req.json().catch(() => null) as null | { taskIds?: unknown };
    if (!body || !Array.isArray(body.taskIds) || body.taskIds.length < 1 || body.taskIds.length > 100) {
      return json({ success: false, error: 'taskIds debe contener entre 1 y 100 IDs' }, 400);
    }
    const taskIds = Array.from(new Set(body.taskIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
    if (taskIds.length !== body.taskIds.length) {
      return json({ success: false, error: 'taskIds contiene IDs vacíos o duplicados' }, 400);
    }

    const results: Array<Record<string, unknown>> = [];
    for (const taskId of taskIds) {
      const { data, error: rpcError } = await supabase.rpc('auto_assign_task_transactional', {
        _task_id: taskId,
        _actor_id: actor.userId,
      });
      if (rpcError) {
        results.push({ taskId, success: false, reason: rpcError.message, code: rpcError.code });
        continue;
      }
      const result = data as Record<string, unknown> | null;
      if (!result || typeof result.success !== 'boolean') {
        results.push({ taskId, success: false, reason: 'Resultado semántico inválido de la RPC' });
        continue;
      }
      results.push({ taskId, ...result });
    }

    const assigned = results.filter((result) => result.success === true).length;
    const failedCount = results.length - assigned;
    return json({
      success: failedCount === 0,
      partial: assigned > 0 && failedCount > 0,
      results,
      summary: { total: results.length, assigned, failed: failedCount },
    }, 200);
  } catch (error) {
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    console.error('auto-assign-tasks error', error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
