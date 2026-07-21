import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@6.17.2";
import {
  assertAdminManagerOrServiceRole,
  authorizationErrorResponse,
} from '../_shared/edgeAuthorization.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] ?? char));

type TaskInput = {
  propertyId: string;
  date: string;
  startTime: string;
  endTime: string;
  type?: string;
  status?: string;
  checkIn?: string;
  checkOut?: string;
  duration?: number;
  cost?: number;
  paymentMethod?: string;
  supervisor?: string;
  cleanerId?: string;
  cleanerIds?: string[];
};
type EmailBatch = {
  cleanerId: string;
  cleanerName: string;
  email: string;
  tasks: Array<{ taskId: string; property: string; address: string; date: string; startTime: string; endTime: string }>;
};
const sha256 = async (value: string) => Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
).map((byte) => byte.toString(16).padStart(2, '0')).join('');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  let tasksCommitted = false;
  let committedTaskIds: string[] = [];
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const actor = await assertAdminManagerOrServiceRole(req, supabase, serviceRoleKey);
    if (actor.kind !== 'user' || !actor.userId) {
      return json({ success: false, error: 'Se requiere una sesión de usuario admin/manager' }, 403);
    }

    const body = await req.json().catch(() => null) as null | {
      tasks?: TaskInput[];
      sedeId?: string;
      sendEmails?: boolean;
      idempotencyKey?: string;
    };
    if (!body || !Array.isArray(body.tasks) || body.tasks.length < 1 || body.tasks.length > 50 || !body.sedeId || !body.idempotencyKey) {
      return json({ success: false, error: 'tasks (1..50), sedeId e idempotencyKey son obligatorios' }, 400);
    }

    const tasks = body.tasks.map((task) => ({
      ...task,
      cleanerIds: Array.from(new Set(
        (task.cleanerIds?.length ? task.cleanerIds : [task.cleanerId])
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      )),
      cleanerId: undefined,
    }));
    const payloadHash = await sha256(JSON.stringify({ sedeId: body.sedeId, tasks }));

    const { data, error: rpcError } = await supabase.rpc('batch_create_tasks_transactional', {
      _actor_id: actor.userId,
      _sede_id: body.sedeId,
      _tasks: tasks,
      _idempotency_key: body.idempotencyKey,
      _payload_hash: payloadHash,
    });
    if (rpcError) {
      console.error('batch_create_tasks_transactional failed', rpcError.code, rpcError.message);
      const status = rpcError.code === '42501' ? 403 : rpcError.code === '22023' ? 400 : 500;
      return json({ success: false, tasksCommitted: false, error: rpcError.message }, status);
    }

    const result = data as {
      success: boolean;
      created: number;
      taskIds: string[];
      emailBatches: EmailBatch[];
      requestId: string;
      idempotentReplay?: boolean;
    };
    if (!result?.success || result.created !== body.tasks.length) {
      return json({ success: false, tasksCommitted: false, error: 'Resultado semántico inválido de la RPC' }, 500);
    }
    tasksCommitted = true;
    committedTaskIds = result.taskIds;

    const emailFailures: Array<{ cleanerId: string; error: string }> = [];
    let emailsSent = 0;
    if (body.sendEmails) {
      const apiKey = Deno.env.get('RESEND_API_KEY');
      if (!apiKey) {
        emailFailures.push({ cleanerId: '*', error: 'RESEND_API_KEY no configurada' });
      } else {
        const resend = new Resend(apiKey);
        for (const batch of result.emailBatches ?? []) {
          const { data: delivery, error: deliveryReadError } = await supabase
            .from('batch_task_email_deliveries')
            .select('id,status,idempotency_key,attempts')
            .eq('request_id', result.requestId)
            .eq('cleaner_id', batch.cleanerId)
            .single();
          if (deliveryReadError || !delivery) {
            emailFailures.push({ cleanerId: batch.cleanerId, error: deliveryReadError?.message ?? 'Estado durable de email ausente' });
            continue;
          }
          if (delivery.status === 'sent') {
            emailsSent += 1;
            continue;
          }
          const { error: claimError } = await supabase.from('batch_task_email_deliveries').update({
            status: 'sending', attempts: (delivery.attempts ?? 0) + 1, last_error: null, updated_at: new Date().toISOString(),
          }).eq('id', delivery.id);
          if (claimError) {
            emailFailures.push({ cleanerId: batch.cleanerId, error: claimError.message });
            continue;
          }
          const tasksList = batch.tasks.map((task) => `<li><strong>${escapeHtml(task.property)}</strong> - ${escapeHtml(task.date)} (${escapeHtml(task.startTime)} - ${escapeHtml(task.endTime)})</li>`).join('');
          try {
            const emailResponse = await resend.emails.send({
              from: 'Sistema de Gestión <alertas@limpatexgestion.es>',
              to: [batch.email],
              subject: `📋 ${batch.tasks.length} Nuevas Tareas Asignadas`,
              html: `<div><h2>Nuevas tareas asignadas</h2><p>Hola <strong>${escapeHtml(batch.cleanerName)}</strong>,</p><ul>${tasksList}</ul></div>`,
            }, { idempotencyKey: delivery.idempotency_key });
            if (emailResponse.error) throw new Error(emailResponse.error.message);
            const { error: markSentError } = await supabase.from('batch_task_email_deliveries').update({
              status: 'sent', provider_message_id: emailResponse.data?.id ?? null, last_error: null, updated_at: new Date().toISOString(),
            }).eq('id', delivery.id);
            if (markSentError) throw markSentError;
            emailsSent += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await supabase.from('batch_task_email_deliveries').update({
              status: 'failed', last_error: message, updated_at: new Date().toISOString(),
            }).eq('id', delivery.id);
            emailFailures.push({ cleanerId: batch.cleanerId, error: message });
          }
        }
      }
    }

    if (emailFailures.length > 0) {
      return json({
        success: false,
        tasksCommitted: true,
        created: result.created,
        taskIds: result.taskIds,
        emailsSent,
        emailFailures,
        error: 'Las tareas se confirmaron, pero uno o más emails consolidados fallaron',
      }, 502);
    }

    return json({
      success: true,
      tasksCommitted: true,
      created: result.created,
      taskIds: result.taskIds,
      emailsSent,
    });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    console.error('batch-create-tasks error', error);
    return json({ success: false, tasksCommitted, taskIds: committedTaskIds, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
