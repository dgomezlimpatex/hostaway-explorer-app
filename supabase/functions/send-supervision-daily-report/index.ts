import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonRecord = Record<string, unknown>;
type Route = { id: string; sede_id: string | null; name: string; status: string; sede?: { nombre?: string } | null };
type Stop = { label: string; stop_type: string; status: string };
type Review = { state: string };
type Incident = { category: string; priority: string; description: string };

type ResendEmailResult = { data: { id?: string } | null; error: { message: string } | null };

const clean = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');
const escapeHtml = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const hasServiceRoleAuthorization = (req: Request, serviceRoleKey: string) => {
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 && token === serviceRoleKey;
};

const adminGet = async (baseUrl: string, token: string, table: string, query: Record<string, string>): Promise<unknown> => {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/rest/v1/${table}`);
  Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { headers: { apikey: token, Authorization: 'Bearer ' + token } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supabase GET ${table} failed (${response.status})`);
  return body;
};

const adminUpsert = async (baseUrl: string, token: string, table: string, row: JsonRecord, conflictColumn: string) => {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/rest/v1/${table}`);
  url.searchParams.set('on_conflict', conflictColumn);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: token,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Supabase UPSERT ${table} failed (${response.status})`);
};

const sendResendEmail = async (token: string, payload: JsonRecord): Promise<ResendEmailResult> => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { data: null, error: { message: body?.message || `Resend HTTP ${response.status}` } };
  return { data: { id: body?.id }, error: null };
};

function buildSimplePdf(lines: string[]): string {
  const body = ['BT', '/F1 10 Tf', '45 800 Td', ...lines.flatMap((line) => [`(${clean(line).replace(/[()\\]/g, '\\$&')}) Tj`, '0 -15 Td']), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets[index + 1] = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

const base64 = (value: string) => btoa(value);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    const force = payload.force === true;
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!url || !serviceRoleKey || !resendKey) throw new Error('Missing secure daily report configuration');
    if (!hasServiceRoleAuthorization(req, serviceRoleKey)) return new Response(JSON.stringify({ error: 'service role authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const madrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const parts = Object.fromEntries(madrid.map((part) => [part.type, part.value]));
    if (!force && parts.hour !== '19') return new Response(JSON.stringify({ skipped: true, reason: 'outside 19:00 Europe/Madrid window' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const date = payload.date || `${parts.year}-${parts.month}-${parts.day}`;
    const routesBody = await adminGet(url, serviceRoleKey, 'supervision_routes', { select: '*,sede:sedes(nombre)', route_date: `eq.${date}`, order: 'sede_id,created_at' });
    const routes = Array.isArray(routesBody) ? routesBody as Route[] : [];
    const recipient = Deno.env.get('SUPERVISION_REPORT_RECIPIENT') || 'dgomez@limpatex.com';

    if (!force) {
      const sentBody = await adminGet(url, serviceRoleKey, 'supervision_daily_reports', { select: 'id', report_date: `eq.${date}`, email_status: 'eq.sent', limit: '1' });
      if (Array.isArray(sentBody) && sentBody.length > 0) return new Response(JSON.stringify({ skipped: true, reason: 'report already sent for date' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const reportLines: string[] = [`LIMPATEX · INFORME DIARIO DE SUPERVISION · ${date}`, `Destinatario: ${recipient}`, ''];
    const htmlSections: string[] = [];
    for (const route of routes) {
      const [stopsBody, reviewsBody, incidentsBody] = await Promise.all([
        adminGet(url, serviceRoleKey, 'supervision_route_stops', { select: 'label,stop_type,status', route_id: `eq.${route.id}`, order: 'sequence' }),
        adminGet(url, serviceRoleKey, 'supervision_reviews', { select: 'route_stop_id,state,result,completed_at', route_id: `eq.${route.id}`, order: 'created_at.desc' }),
        adminGet(url, serviceRoleKey, 'supervision_incidents', { select: 'category,priority,status,description', route_id: `eq.${route.id}`, order: 'created_at.desc' }),
      ]);
      const stops = Array.isArray(stopsBody) ? stopsBody as Stop[] : [];
      const reviews = Array.isArray(reviewsBody) ? reviewsBody as Review[] : [];
      const incidents = Array.isArray(incidentsBody) ? incidentsBody as Incident[] : [];
      const reviewCount = reviews.filter((review) => review.state !== 'historical').length;
      reportLines.push(`${route.sede?.nombre || 'Sede'} · ${route.name} · ${route.status}`);
      reportLines.push(`Paradas: ${stops.length} · Revisadas: ${reviewCount} · Incidencias: ${incidents.length}`);
      stops.forEach((stop, index) => reportLines.push(`  ${index + 1}. ${stop.label} · ${stop.stop_type} · ${stop.status}`));
      incidents.forEach((incident) => reportLines.push(`  INCIDENCIA ${incident.priority}: ${incident.category} · ${incident.description}`));
      htmlSections.push(`<h2>${escapeHtml(route.sede?.nombre || 'Sede')} · ${escapeHtml(route.name)}</h2><p>Paradas: ${stops.length} · Revisadas: ${reviewCount} · Incidencias: ${incidents.length}</p><ul>${stops.map((stop) => `<li>${escapeHtml(stop.label)} · ${escapeHtml(stop.status)}</li>`).join('')}</ul>`);
    }

    const { data: resendData, error: resendError } = await sendResendEmail(resendKey, {
      from: 'Limpatex Gestión <alertas@limpatexgestion.es>',
      to: [recipient],
      subject: `Informe diario de supervisión · ${date}`,
      html: `<div style="font-family:Arial,sans-serif"><h1>Informe diario de supervisión</h1><p>${escapeHtml(date)}</p>${htmlSections.join('')}</div>`,
      attachments: [{ filename: `supervision-${date}.pdf`, content: base64(buildSimplePdf(reportLines)) }],
    });
    if (resendError) throw new Error(`Resend rejected daily report: ${resendError.message || 'unknown provider error'}`);

    for (const route of routes) await adminUpsert(url, serviceRoleKey, 'supervision_daily_reports', { route_id: route.id, sede_id: route.sede_id, report_date: date, email_to: recipient, email_status: 'sent', sent_at: new Date().toISOString(), error_message: null }, 'route_id');
    return new Response(JSON.stringify({ ok: true, routes: routes.length, messageId: resendData?.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('supervision daily report failed', error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
