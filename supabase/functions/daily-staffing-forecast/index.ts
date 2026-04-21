import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HORIZON_DAYS = 30;
const SHIFT_HOURS = 6;
const ANOMALY_CHECKOUTS_THRESHOLD = 100;

const madridDate = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

interface DayForecast {
  date: string;
  dayOfWeek: number;
  checkouts: number;
  cargaHoras: number;
  capacidadHoras: number;
  workersAvailable: number;
  minWorkers: number;
  estado: "green" | "yellow" | "red" | "idle";
  deficitHoras: number;
  deficitPersonas: number;
  anomaly: boolean;
}

const computeStatus = (
  carga: number,
  capacidad: number,
  workers: number,
  minWorkers: number
): DayForecast["estado"] => {
  if (carga === 0) return "idle";
  const cob = capacidad / carga;
  const wOk = workers >= minWorkers;
  if (cob >= 1.1 && wOk) return "green";
  if (cob >= 0.9 && wOk) return "yellow";
  return "red";
};

async function calcForecast(
  supabase: ReturnType<typeof createClient>,
  sedeId: string | null
): Promise<DayForecast[]> {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + HORIZON_DAYS);
  const startStr = madridDate(start);
  const endStr = madridDate(end);

  // Avantio
  let avantioQ = supabase
    .from("avantio_reservations")
    .select("departure_date, property_id, properties(duracion_servicio, sede_id)")
    .gte("departure_date", startStr)
    .lte("departure_date", endStr)
    .neq("status", "CAN");
  const { data: avantio } = await avantioQ;

  // Internas
  let intQ = supabase
    .from("client_reservations")
    .select("check_out_date, property_id, properties(duracion_servicio, sede_id)")
    .gte("check_out_date", startStr)
    .lte("check_out_date", endStr)
    .neq("status", "cancelled");
  const { data: internas } = await intQ;

  // Cleaners + availability + ausencias
  let cleanersQ = supabase.from("cleaners").select("id, sede_id").eq("is_active", true);
  if (sedeId) cleanersQ = cleanersQ.eq("sede_id", sedeId);
  const { data: cleaners } = await cleanersQ;
  const cleanerIds = (cleaners ?? []).map((c: any) => c.id);

  const { data: availability } = await supabase
    .from("cleaner_availability")
    .select("cleaner_id, day_of_week, is_available, start_time, end_time")
    .in("cleaner_id", cleanerIds.length ? cleanerIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: absences } = await supabase
    .from("worker_absences")
    .select("cleaner_id, start_date, end_date")
    .gte("end_date", startStr)
    .lte("start_date", endStr);

  // Targets
  let targetsQ = supabase.from("staffing_targets").select("*");
  if (sedeId) targetsQ = targetsQ.eq("sede_id", sedeId);
  const { data: targets } = await targetsQ;
  const targetByDow: Record<number, { min_workers: number; min_hours: number }> = {};
  for (let d = 0; d < 7; d++) targetByDow[d] = { min_workers: 2, min_hours: 12 };
  (targets ?? []).forEach((t: any) => {
    targetByDow[t.day_of_week] = { min_workers: t.min_workers, min_hours: t.min_hours };
  });

  const days: DayForecast[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = madridDate(d);
    const dow = d.getDay();

    const dayAvantio = (avantio ?? []).filter((r: any) => {
      if (r.departure_date !== dateStr) return false;
      if (sedeId && r.properties?.sede_id !== sedeId) return false;
      return true;
    });
    const dayInternas = (internas ?? []).filter((r: any) => {
      if (r.check_out_date !== dateStr) return false;
      if (sedeId && r.properties?.sede_id !== sedeId) return false;
      return true;
    });

    const checkouts = dayAvantio.length + dayInternas.length;
    const anomaly = checkouts > ANOMALY_CHECKOUTS_THRESHOLD;
    const cargaHoras = anomaly
      ? 0
      : [...dayAvantio, ...dayInternas].reduce(
          (s: number, r: any) => s + (r.properties?.duracion_servicio ?? 2),
          0
        );

    const absentToday = new Set(
      (absences ?? [])
        .filter((a: any) => a.start_date <= dateStr && a.end_date >= dateStr)
        .map((a: any) => a.cleaner_id)
    );

    let capacidadHoras = 0;
    let workersAvailable = 0;
    (availability ?? []).forEach((a: any) => {
      if (a.day_of_week !== dow || !a.is_available) return;
      if (absentToday.has(a.cleaner_id)) return;
      if (!cleanerIds.includes(a.cleaner_id)) return;
      const [sh, sm] = (a.start_time ?? "06:00").split(":").map(Number);
      const [eh, em] = (a.end_time ?? "23:00").split(":").map(Number);
      const hours = Math.max(0, eh + em / 60 - (sh + sm / 60));
      capacidadHoras += hours;
      workersAvailable += 1;
    });

    const target = targetByDow[dow];
    const estado = anomaly
      ? "yellow"
      : computeStatus(cargaHoras, capacidadHoras, workersAvailable, target.min_workers);
    const deficitHoras = Math.max(0, cargaHoras - capacidadHoras);
    const deficitPersonas = Math.ceil(deficitHoras / SHIFT_HOURS);

    days.push({
      date: dateStr,
      dayOfWeek: dow,
      checkouts,
      cargaHoras: Math.round(cargaHoras * 10) / 10,
      capacidadHoras: Math.round(capacidadHoras * 10) / 10,
      workersAvailable,
      minWorkers: target.min_workers,
      estado,
      deficitHoras: Math.round(deficitHoras * 10) / 10,
      deficitPersonas,
      anomaly,
    });
  }
  return days;
}

const renderEmail = (subscriberEmail: string, alerts: DayForecast[], origin: string) => {
  const rows = alerts
    .map(
      (d) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">
            <strong>${d.date}</strong>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">
            ${d.checkouts}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${d.estado === "red" ? "#dc2626" : "#d97706"};font-weight:600;">
            ${d.estado === "red" ? "DÉFICIT" : "AJUSTADO"}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">
            ${d.deficitHoras}h · ${d.deficitPersonas}p
          </td>
        </tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#f9f9f9;">
      <div style="background:white;border-radius:12px;padding:24px;">
        <h1 style="margin:0 0 8px;color:#111;font-size:20px;">Previsión de personal — alertas</h1>
        <p style="margin:0 0 16px;color:#555;font-size:14px;">
          Se han detectado <strong>${alerts.length} día(s)</strong> en alerta en los próximos 30 días.
          Revísalos y refuerza la plantilla con tiempo.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fafafa;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 12px;text-align:left;">Fecha</th>
              <th style="padding:10px 12px;text-align:center;">Checkouts</th>
              <th style="padding:10px 12px;text-align:center;">Estado</th>
              <th style="padding:10px 12px;text-align:right;">Déficit</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:20px 0 0;text-align:center;">
          <a href="${origin}/forecast" style="background:#7c3aed;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px;display:inline-block;">
            Ver previsión completa
          </a>
        </p>
        <p style="margin:20px 0 0;color:#999;font-size:11px;text-align:center;">
          Este aviso se envía a ${subscriberEmail} según tus preferencias en Limpatex.
        </p>
      </div>
    </div>`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const origin = req.headers.get("origin") ?? "https://limpatexgestion.lovable.app";

  // Modo prueba: { test: true, email: '...' } envía solo a un destinatario sin tocar el log
  let testMode = false;
  let testEmail: string | null = null;
  try {
    const body = await req.json();
    if (body?.test) {
      testMode = true;
      testEmail = body.email ?? null;
    }
  } catch {
    /* sin body, cron */
  }

  // Suscriptores activos
  const { data: subscribers, error: subErr } = await supabase
    .from("forecast_subscribers")
    .select("*")
    .eq("is_active", true);
  if (subErr) {
    console.error("Error fetching subscribers", subErr);
    return new Response(JSON.stringify({ error: subErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targetSubs = testMode && testEmail
    ? [{ email: testEmail, sede_id: null, min_days_advance: 30, user_id: null } as any]
    : subscribers ?? [];

  let totalSent = 0;
  let totalAlertsLogged = 0;

  // Agrupar suscriptores por sede para evitar recalcular
  const sedeGroups = new Map<string | null, typeof targetSubs>();
  for (const s of targetSubs) {
    const k = s.sede_id ?? null;
    if (!sedeGroups.has(k)) sedeGroups.set(k, []);
    sedeGroups.get(k)!.push(s);
  }

  for (const [sedeId, subs] of sedeGroups) {
    const days = await calcForecast(supabase, sedeId);

    for (const sub of subs) {
      const horizon = sub.min_days_advance ?? 7;
      const horizonStr = madridDate(
        new Date(Date.now() + horizon * 24 * 3600 * 1000)
      );
      const alerts = days.filter(
        (d) =>
          (d.estado === "red" || d.estado === "yellow") &&
          d.date <= horizonStr &&
          !d.anomaly &&
          d.checkouts > 0
      );

      // Filtrar alertas no enviadas / no descartadas (solo en modo real)
      let toSend = alerts;
      if (!testMode) {
        const { data: existingLogs } = await supabase
          .from("forecast_alerts_log")
          .select("alert_date, alert_type, dismissed_at")
          .eq("recipient_email", sub.email)
          .gte("alert_date", days[0].date);
        const sentKey = new Set(
          (existingLogs ?? [])
            .filter((l: any) => !l.dismissed_at)
            .map((l: any) => `${l.alert_date}|${l.alert_type}`)
        );
        toSend = alerts.filter((a) => !sentKey.has(`${a.date}|${a.estado}`));
      }

      if (toSend.length === 0) continue;

      try {
        await resend.emails.send({
          from: "Previsión Limpatex <noreply@limpatexgestion.com>",
          to: [sub.email],
          subject: `⚠️ ${toSend.length} día(s) en alerta — previsión de personal`,
          html: renderEmail(sub.email, toSend, origin),
        });
        totalSent += 1;

        if (!testMode) {
          for (const a of toSend) {
            await supabase.from("forecast_alerts_log").insert({
              alert_date: a.date,
              alert_type: a.estado,
              deficit_hours: a.deficitHoras,
              deficit_workers: a.deficitPersonas,
              recipient_email: sub.email,
              sede_id: sedeId,
              metadata: { checkouts: a.checkouts },
            });
            totalAlertsLogged += 1;
          }
        }
      } catch (e) {
        console.error("Error sending email to", sub.email, e);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      emailsSent: totalSent,
      alertsLogged: totalAlertsLogged,
      testMode,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
};

serve(handler);
