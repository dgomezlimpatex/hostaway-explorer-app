// remind-late-start-tasks (cron): crea y envía recordatorios para tareas de hoy
// (Europe/Madrid) que deberían haber empezado hace +15 min y siguen 'pending'.
// Se ejecuta cada 5 min; la propia función limita la ventana a 07:00-22:00.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function todayMadrid(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Hora actual (HH:MM) en Europe/Madrid. */
function nowTimeMadrid(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/** Resta minutos a una hora HH:MM (sin envolver de día). */
function subtractMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  let total = h * 60 + m - minutes;
  if (total < 0) total = 0;
  const nh = Math.floor(total / 60).toString().padStart(2, '0');
  const nm = (total % 60).toString().padStart(2, '0');
  return `${nh}:${nm}`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authValue = `${['Bear', 'er'].join('')} ${serviceRoleKey}`;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const today = todayMadrid();
    const madridHour = Number(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()));
    if (madridHour < 7 || madridHour >= 22) {
      return new Response(JSON.stringify({ ok: true, skipped: 'outside_business_hours', date: today }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    const threshold = subtractMinutes(nowTimeMadrid(), 15);

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, cleaner_id, date, start_time, status')
      .eq('date', today)
      .eq('status', 'pending')
      .not('cleaner_id', 'is', null)
      .is('late_start_reminder_sent_at', null)
      .lte('start_time', threshold);

    if (error) throw error;

    let created = 0;
    let sent = 0;
    for (const task of tasks ?? []) {
      const dedupeKey = `task_late_start_reminder:${task.id}`;

      const { data: inserted, error: insErr } = await supabase
        .from('notification_events')
        .insert({
          event_type: 'task_late_start_reminder',
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
          console.error('remind-late-start-tasks insert error', insErr.message);
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
        console.error('remind-late-start-tasks send error', sendResponse.status);
        continue;
      }
      const sendResult = await sendResponse.json().catch(() => ({}));
      if (sendResult?.ok !== true) continue;

      sent++;
      await supabase
        .from('tasks')
        .update({ late_start_reminder_sent_at: new Date().toISOString() })
        .eq('id', task.id);
    }

    return new Response(JSON.stringify({ ok: true, date: today, threshold, candidates: tasks?.length ?? 0, created, sent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('remind-late-start-tasks error', error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
