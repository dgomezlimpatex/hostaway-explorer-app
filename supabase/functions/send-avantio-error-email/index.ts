import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ErrorEmailRequest {
  syncLogId: string;
  success: boolean;
  errorSummary: string;
  errorDetails: string;
  stats: {
    reservations_processed: number;
    new_reservations: number;
    updated_reservations: number;
    tasks_created: number;
    errors_count: number;
  };
  timestamp: string;
}

const formatSpanishDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const generateEmailHTML = (data: ErrorEmailRequest): string => {
  const formattedDate = formatSpanishDate(data.timestamp);
  const statusColor = data.success ? '#f59e0b' : '#dc2626';
  const statusText = data.success ? 'Completada con Errores' : 'FALLIDA';
  const statusEmoji = data.success ? '⚠️' : '🚨';

  const errorLines = data.errorDetails
    .split('\n')
    .map(line => `<li style="margin: 4px 0; font-size: 13px;">${line}</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Error en Sincronización Avantio</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, ${statusColor}, ${statusColor}dd); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
        .stat-card { background: white; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #333; }
        .stat-label { font-size: 12px; color: #666; }
        .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 15px 0; }
        .error-title { color: #dc2626; font-weight: bold; margin-bottom: 10px; }
        .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${statusEmoji} Sincronización Avantio: ${statusText}</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">${formattedDate}</p>
      </div>
      
      <div class="content">
        <p><strong>${data.errorSummary}</strong></p>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${data.stats.reservations_processed}</div>
            <div class="stat-label">Reservas procesadas</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.new_reservations}</div>
            <div class="stat-label">Nuevas reservas</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${data.stats.tasks_created}</div>
            <div class="stat-label">Tareas creadas</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: #dc2626;">${data.stats.errors_count}</div>
            <div class="stat-label">Errores</div>
          </div>
        </div>

        <div class="error-box">
          <div class="error-title">Detalle de Errores (máx. 20):</div>
          <ul style="padding-left: 20px; margin: 10px 0;">
            ${errorLines}
          </ul>
        </div>

        <h3>🔧 Acciones Recomendadas:</h3>
        <ul>
          <li>Revisa los errores de "Propiedad no encontrada" y vincula las propiedades en el sistema</li>
          <li>Accede a <strong>Avantio Automatización</strong> en el dashboard para ver todos los errores</li>
          <li>Marca los errores como resueltos una vez verificados</li>
        </ul>
      </div>
      
      <div class="footer">
        <p>Email enviado automáticamente por el sistema de gestión de limpieza.<br/>
        Accede al panel de errores en: Avantio Automatización → Errores de Sincronización</p>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ErrorEmailRequest = await req.json();

    console.log(`📧 Enviando email de error Avantio: ${data.errorSummary}`);

    const statusEmoji = data.success ? '⚠️' : '🚨';
    const statusText = data.success ? 'Errores' : 'FALLO';

    const emailResponse = await resend.emails.send({
      from: "Sistema Avantio <noreply@resend.dev>",
      to: ["dgomezlimpatex@gmail.com"],
      subject: `${statusEmoji} Sincronización Avantio: ${statusText} - ${data.stats.errors_count} errores`,
      html: generateEmailHTML(data),
    });

    console.log("✅ Email de error Avantio enviado:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error enviando email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
