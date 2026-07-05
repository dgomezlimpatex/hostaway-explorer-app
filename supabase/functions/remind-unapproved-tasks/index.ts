// remind-unapproved-tasks (cron): crea eventos de recordatorio para tareas de hoy
// (Europe/Madrid) que siguen pendientes de aprobación. No envía directamente;
// deja el notification_event para que send-whatsapp-notification lo procese.
// Recomendado: cada 15 min de 07:00 a 20:00 Europe/Madrid.

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const today = todayMadrid();

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, cleaner_id, date')
      .eq('date', today)
      .eq('approval_status', 'pending')
      .not('cleaner_id', 'is', null)
      .is('last_approval_reminder_at', null);

    if (error) throw error;

    let created = 0;
    for (const task of tasks ?? []) {
      const dedupeKey = `task_approval_reminder:${task.id}:${task.date}`;

      const { error: insErr } = await supabase
        .from('notification_events')
        .insert({
          event_type: 'task_approval_reminder',
          entity_type: 'tasks',
          entity_id: task.id,
          task_id: task.id,
          cleaner_id: task.cleaner_id,
          dedupe_key: dedupeKey,
          status: 'pending',
        });

      // Si choca con el índice único de dedupe, ya existía: lo ignoramos.
      if (insErr && !String(insErr.message ?? '').includes('duplicate')) {
        console.error('remind-unapproved-tasks insert error', insErr.message);
        continue;
      }
      if (!insErr) {
        created++;
        await supabase
          .from('tasks')
          .update({ last_approval_reminder_at: new Date().toISOString() })
          .eq('id', task.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, date: today, candidates: tasks?.length ?? 0, created }), {
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
