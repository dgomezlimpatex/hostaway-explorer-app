import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { incidentId } = await req.json();
    if (!incidentId) {
      return new Response(JSON.stringify({ error: "incidentId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase service configuration");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: incident, error } = await admin
      .from("cleaning_incidents")
      .select(`
        id,
        description,
        location,
        created_at,
        status,
        category:incident_categories(label),
        client:clients(nombre),
        property:properties(nombre, codigo),
        cleaner:cleaners!cleaning_incidents_reporter_cleaner_id_fkey(name),
        task:tasks(date, start_time, end_time)
      `)
      .eq("id", incidentId)
      .maybeSingle();

    if (error) throw error;
    if (!incident) {
      return new Response(JSON.stringify({ error: "Incident not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const appUrl = Deno.env.get("APP_BASE_URL") || "https://gestionlimpatex.vercel.app";
    const reportsUrl = `${appUrl}/cleaning-reports`;
    const propertyLabel = `${incident.property?.codigo ? `${incident.property.codigo} · ` : ""}${incident.property?.nombre ?? "Sin propiedad"}`;
    const subject = `Nueva incidencia pendiente · ${propertyLabel}`;

    const emailResponse = await resend.emails.send({
      from: "Limpatex Gestión <alertas@gestionlimpatex.es>",
      to: ["dgomezlimpatex@gmail.com"],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background: #f8fafc;">
          <div style="background: white; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 8px; color: #dc2626; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;">
              Nueva incidencia pendiente de revisión
            </p>
            <h1 style="margin: 0 0 18px; color: #111827; font-size: 22px;">${escapeHtml(propertyLabel)}</h1>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
              <tr><td style="padding: 7px 0; color: #6b7280; width: 130px;">Cliente</td><td style="padding: 7px 0; color: #111827; font-weight: 600;">${escapeHtml(incident.client?.nombre || "Sin cliente")}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b7280;">Categoría</td><td style="padding: 7px 0; color: #111827;">${escapeHtml(incident.category?.label || "Incidencia")}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b7280;">Ubicación</td><td style="padding: 7px 0; color: #111827;">${escapeHtml(incident.location || "No indicada")}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b7280;">Reportada por</td><td style="padding: 7px 0; color: #111827;">${escapeHtml(incident.cleaner?.name || "No indicado")}</td></tr>
              <tr><td style="padding: 7px 0; color: #6b7280;">Fecha tarea</td><td style="padding: 7px 0; color: #111827;">${escapeHtml(incident.task?.date || "No indicada")}</td></tr>
            </table>

            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
              <p style="margin: 0 0 6px; color: #9a3412; font-size: 12px; font-weight: 700; text-transform: uppercase;">Descripción</p>
              <p style="margin: 0; color: #111827; white-space: pre-wrap;">${escapeHtml(incident.description)}</p>
            </div>

            <a href="${reportsUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 700;">
              Revisar incidencia
            </a>

            <p style="margin: 24px 0 0; color: #6b7280; font-size: 12px;">
              Este aviso se ha generado automáticamente desde el sistema de gestión Limpatex.
            </p>
          </div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true, messageId: emailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error sending incident notification:", error);
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
