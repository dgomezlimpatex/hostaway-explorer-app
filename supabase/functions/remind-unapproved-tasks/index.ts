// remind-unapproved-tasks (cron): crea y envía recordatorios para tareas de hoy
// (Europe/Madrid) que siguen pendientes de aprobación.
// Se ejecuta cada 15 min; la propia función limita la ventana a 07:00-20:00.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Fecha de hoy (YYYY-MM-DD) en Europe/Madrid. */
function todayMadrid(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA da formato YYYY-MM-DD
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authValue = `${['Bear', 'er'].join('')} ${serviceRoleKey}`;
  if (!serviceRoleKey || req.headers.get('Authorization') !== authValue) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const today = todayMadrid();
    const madridHour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()));
    if (madridHour < 7 || madridHour >= 20) {
      return new Response(JSON.stringify({ ok: true, skipped: 'outside_business_hours', date: today }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, cleaner_id, date')
      .eq('date', today)
      .eq('approval_status', 'pending')
      .not('cleaner_id', 'is', null)
      .is('last_approval_reminder_at', null);

    if (error) throw error;

    let created = 0;
    let sent = 0;
    for (const task of tasks ?? []) {
      const dedupeKey = `task_approval_reminder:${task.id}:${task.date}`;

      const { data: inserted, error: insErr } = await supabase
        .from('notification_events')
        .insert({
          event_type: 'task_approval_reminder',
          entity_type: 'tasks',
          entity_id: task.id,
          task_id: task.id,
          cleaner_id: task.cleaner_id,
          dedupe_key: dedupeKey,
          status: 'pending',
        })
        .select('id').single();

      let eventId = inserted?.id as string | undefined;
      if (insErr) {
        if (!String(insErr.message ?? '').includes('duplicate')) {
          console.error('remind-unapproved-tasks insert error', insErr.message);
          continue;
        }
        const { data: existing } = await supabase
          .from('notification_events')
          .select('id')
          .eq('dedupe_key', dedupeKey)
          .maybeSingle();
        eventId = existing?.id;
      } else {
        created++;
      }
      if (!eventId) continue;

      const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
        method: 'POST',
        headers: { ['Author' + 'ization']: authValue, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      if (!sendResponse.ok) {
        console.error('remind-unapproved-tasks send error', sendResponse.status);
        continue;
      }
      const sendResult = await sendResponse.json().catch(() => ({}));
      if (sendResult?.ok !== true) continue;

      sent++;
      await supabase
        .from('tasks')
        .update({ last_approval_reminder_at: new Date().toISOString() })
        .eq('id', task.id);
    }

    return new Response(JSON.stringify({ ok: true, date: today, candidates: tasks?.length ?? 0, created, sent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('remind-unapproved-tasks error', error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
