import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonRecord = Record<string, unknown>;
type Incident = {
  priority?: string;
  category?: string;
  description?: string;
  sede?: { nombre?: string } | null;
  property?: { nombre?: string; codigo?: string } | null;
  route?: { name?: string; route_date?: string } | null;
};
type ResendEmailResult = { data: { id?: string } | null; error: { message: string } | null };

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const payload = await req.json().catch(() => ({}));
    const incidentId = payload.incidentId;
    if (!incidentId) return new Response(JSON.stringify({ error: 'incidentId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!url || !serviceRoleKey || !resendKey) throw new Error('Missing secure email configuration');
    if (!hasServiceRoleAuthorization(req, serviceRoleKey)) return new Response(JSON.stringify({ error: 'service role authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await adminGet(url, serviceRoleKey, 'supervision_incidents', {
      select: '*,sede:sedes(nombre),property:properties(nombre,codigo),route:supervision_routes(name,route_date)',
      id: `eq.${incidentId}`,
      limit: '1',
    });
    const incident = Array.isArray(body) ? body[0] as Incident | undefined : undefined;
    if (!incident) return new Response(JSON.stringify({ error: 'Incident not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const recipient = Deno.env.get('SUPERVISION_REPORT_RECIPIENT') || 'dgomez@limpatex.com';
    const property = incident.property?.codigo ? `${incident.property.codigo} · ${incident.property.nombre || ''}` : incident.property?.nombre || 'Parada manual';
    const priority = String(incident.priority || 'normal');
    const { data: resendData, error: resendError } = await sendResendEmail(resendKey, {
      from: 'Limpatex Gestión <alertas@limpatexgestion.es>',
      to: [recipient],
      subject: `[${priority.toUpperCase()}] Incidencia de supervisión · ${property}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><p style="color:#310984;font-weight:700;text-transform:uppercase">Supervisión y calidad</p><h1>${escapeHtml(property)}</h1><p><strong>Prioridad:</strong> ${escapeHtml(priority)} · <strong>Categoría:</strong> ${escapeHtml(incident.category)}</p><p><strong>Sede:</strong> ${escapeHtml(incident.sede?.nombre)} · <strong>Ruta:</strong> ${escapeHtml(incident.route?.name)}</p><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px"><strong>Descripción</strong><p style="white-space:pre-wrap">${escapeHtml(incident.description)}</p></div><p>El sistema no bloquea el apartamento. La decisión operativa corresponde al equipo gestor.</p></div>`,
    });
    if (resendError) throw new Error(`Resend rejected incident email: ${resendError.message || 'unknown provider error'}`);
    return new Response(JSON.stringify({ ok: true, messageId: resendData?.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('supervision incident email failed', error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
