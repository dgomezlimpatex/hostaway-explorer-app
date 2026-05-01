import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatSpanishDate = (d: string) => {
  try {
    const date = new Date(d + "T00:00:00");
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: req_, error } = await supabase
      .from("client_extraordinary_requests")
      .select(`
        *,
        clients:client_id (nombre, email),
        properties:property_id (nombre, direccion, codigo)
      `)
      .eq("id", request_id)
      .maybeSingle();

    if (error || !req_) {
      console.error("Solicitud no encontrada", error);
      return new Response(JSON.stringify({ error: "no encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientName = (req_ as any).clients?.nombre ?? "Cliente";
    const propertyName = (req_ as any).properties?.nombre ?? "—";
    const propertyCode = (req_ as any).properties?.codigo ?? "";
    const label = req_.request_type_label_snapshot;
    const date = formatSpanishDate(req_.service_date);
    const time = req_.service_time ?? "—";
    const cost = Number(req_.cost_snapshot ?? 0).toFixed(2);
    const guest = req_.guest_name ?? "—";
    const notes = req_.notes ?? "";

    const subject = `🆕 Nueva solicitud extraordinaria – ${clientName} – ${label}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0; color: white;">
          <h2 style="margin: 0; font-size: 22px;">🆕 Nueva solicitud extraordinaria</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Creada desde el portal del cliente</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280;">Cliente:</td><td style="padding: 8px 0; font-weight: 600;">${clientName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Propiedad:</td><td style="padding: 8px 0; font-weight: 600;">${propertyName} ${propertyCode ? `<span style="color:#9ca3af">(${propertyCode})</span>` : ""}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Servicio:</td><td style="padding: 8px 0; font-weight: 600; color: #6366f1;">${label}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Fecha:</td><td style="padding: 8px 0;">${date}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Hora:</td><td style="padding: 8px 0;">${time}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Huésped:</td><td style="padding: 8px 0;">${guest}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Coste estimado:</td><td style="padding: 8px 0; font-weight: 700; color: #059669;">${cost} €</td></tr>
          </table>
          ${notes ? `<div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-left: 3px solid #6366f1; border-radius: 4px;"><strong>Notas:</strong><br>${notes}</div>` : ""}
          <p style="margin-top: 24px; padding: 12px; background: #ecfdf5; border-radius: 6px; color: #065f46; font-size: 14px;">
            ✅ La tarea ya ha sido creada automáticamente en el calendario.
          </p>
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: "Limpatex <onboarding@resend.dev>",
      to: ["dgomezlimpatex@gmail.com"],
      subject,
      html,
    });

    console.log("Email enviado:", result);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Error notify-extraordinary-request:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
