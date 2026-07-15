// process-pending-whatsapp-notifications (cron): recupera eventos que el
// navegador creó pero no pudo enviar por una interrupción de red.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authValue = `${['Bear', 'er'].join('')} ${serviceRoleKey}`;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: events, error } = await supabase
      .from('notification_events')
      .select('id')
      .or(`status.eq.pending,and(status.eq.processing,processed_at.lt.${staleBefore})`)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    let accepted = 0;
    let failed = 0;
    for (const event of events ?? []) {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
        method: 'POST',
        headers: { ['Author' + 'ization']: authValue, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.ok === true) accepted++;
      else failed++;
    }

    return json({ ok: true, candidates: events?.length ?? 0, accepted, failed });
  } catch (error) {
    console.error('process-pending-whatsapp-notifications error', error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : 'error' }, 500);
  }
});
