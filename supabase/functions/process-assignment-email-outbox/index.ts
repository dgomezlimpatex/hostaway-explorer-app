// process-assignment-email-outbox (cron cada minuto): envía los correos de alta/baja
// de responsable apuntados por set_task_assignments_queue_email. Reutiliza sin
// cambios send-task-assignment-email y send-task-unassignment-email, así que el
// contenido de los correos es el mismo. Solo envía si la asignación sigue vigente.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.50.0';
import {
  buildOutboxEmailRequest,
  classifyOutboxSend,
  type ClaimedOutboxEmail,
  type OutboxSendOutcome,
} from '../_shared/assignmentEmailOutbox.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const WORK_BUDGET_MS = 45_000;
const MIN_TIME_TO_CLAIM_MS = 12_000;
const CLAIM_SIZE = 5;
const MAX_ROWS_PER_RUN = 150;
// Resend admite pocas peticiones por segundo: se envía de una en una y espaciado.
const MIN_GAP_BETWEEN_SENDS_MS = 600;
const SEND_TIMEOUT_MS = 40_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authValue = `${['Bear', 'er'].join('')} ${serviceRoleKey}`;
  if (!serviceRoleKey || req.headers.get('Authorization') !== authValue) {
    return json({ error: 'forbidden' }, 403);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const startedAt = Date.now();
  const totals = { claimed: 0, sent: 0, skipped: 0, retried: 0, failed: 0, lease_lost: 0 };
  let lastSendAt = 0;

  const finish = async (row: ClaimedOutboxEmail, outcome: 'sent' | 'skipped' | 'retry', detail: string | null) => {
    // Si el envío salió pero no se pudo anotar, la reserva caducará y se repetiría:
    // se insiste unos segundos antes de rendirse.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase.rpc('finish_assignment_email', {
        _id: row.id, _lease_token: row.lease_token, _outcome: outcome, _detail: detail,
      });
      if (!error) return String(data);
      console.error('No se pudo cerrar el correo', row.id, error.message);
      await sleep(500 * attempt);
    }
    return 'unrecorded';
  };

  const send = async (row: ClaimedOutboxEmail): Promise<OutboxSendOutcome> => {
    const request = buildOutboxEmailRequest(row);
    const wait = MIN_GAP_BETWEEN_SENDS_MS - (Date.now() - lastSendAt);
    if (wait > 0) await sleep(wait);
    lastSendAt = Date.now();
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${request.functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authValue },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      const body = await response.json().catch(() => null);
      return classifyOutboxSend({ status: response.status, body });
    } catch (error) {
      return classifyOutboxSend({ error });
    }
  };

  try {
    while (Date.now() - startedAt < WORK_BUDGET_MS - MIN_TIME_TO_CLAIM_MS && totals.claimed < MAX_ROWS_PER_RUN) {
      const { data, error } = await supabase.rpc('claim_assignment_emails', { _limit: CLAIM_SIZE });
      if (error) throw new Error(`claim_assignment_emails: ${error.message}`);
      const rows = (data ?? []) as ClaimedOutboxEmail[];
      if (rows.length === 0) break;
      totals.claimed += rows.length;
      for (const row of rows) {
        const result = row.skip_reason
          ? { outcome: 'skipped' as const, detail: row.skip_reason }
          : await send(row);
        const status = await finish(row, result.outcome, result.detail);
        if (status === 'sent') totals.sent += 1;
        else if (status === 'skipped') totals.skipped += 1;
        else if (status === 'pending') totals.retried += 1;
        else if (status === 'failed') {
          totals.failed += 1;
          console.error('Correo de asignación fallido tras agotar intentos', row.id, result.detail);
        } else totals.lease_lost += 1;
      }
    }
    return json({ ok: true, ...totals, elapsed_ms: Date.now() - startedAt });
  } catch (error) {
    console.error('process-assignment-email-outbox', error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error), ...totals }, 500);
  }
});
