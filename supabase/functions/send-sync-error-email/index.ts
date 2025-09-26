import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ErrorEmailRequest {
  error: string;
  scheduleName: string;
  retryAttempt: number;
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

const generateErrorEmailHTML = (error: string, scheduleName: string, retryAttempt: number, timestamp: string): string => {
  const formattedDate = formatSpanishDate(timestamp);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Error en Sincronización Hostaway</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; }
        .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 15px 0; }
        .error-title { color: #dc2626; font-weight: bold; margin-bottom: 10px; }
        .info-row { margin: 8px 0; }
        .label { font-weight: bold; color: #555; }
        .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
        .retry-info { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚨 Error en Sincronización Hostaway</h1>
      </div>
      
      <div class="content">
        <p>Se ha producido un error en la sincronización automática con Hostaway que requiere tu atención.</p>
        
        <div class="error-box">
          <div class="error-title">Detalles del Error:</div>
          <div class="info-row"><span class="label">Horario:</span> ${scheduleName}</div>
          <div class="info-row"><span class="label">Fecha y Hora:</span> ${formattedDate}</div>
          <div class="info-row"><span class="label">Intentos realizados:</span> ${retryAttempt + 1}</div>
        </div>

        ${retryAttempt > 0 ? `
        <div class="retry-info">
          <strong>ℹ️ Información de Reintentos:</strong><br>
          El sistema intentó automáticamente la sincronización después de 5 minutos, pero también falló.
        </div>
        ` : ''}

        <div class="error-box">
          <div class="error-title">Mensaje de Error:</div>
          <code style="background: #f1f1f1; padding: 8px; border-radius: 4px; display: block; margin-top: 8px;">
            ${error}
          </code>
        </div>

        <h3>🔧 Acciones Recomendadas:</h3>
        <ul>
          <li>Verifica la conectividad con la API de Hostaway</li>
          <li>Revisa los logs de sincronización en el dashboard</li>
          <li>Ejecuta una sincronización manual para confirmar el estado</li>
          <li>Si el problema persiste, revisa la configuración de la API</li>
        </ul>

        <p><strong>📋 Próxima sincronización automática:</strong> El sistema continuará con las próximas sincronizaciones programadas según el horario establecido.</p>
      </div>
      
      <div class="footer">
        <p>Este email fue enviado automáticamente por el sistema de gestión de limpieza.<br/>
        Si tienes preguntas, contacta con el equipo técnico.</p>
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
    const { error, scheduleName, retryAttempt, timestamp }: ErrorEmailRequest = await req.json();

    console.log(`📧 Sending error notification email for schedule: ${scheduleName}`);

    const emailResponse = await resend.emails.send({
      from: "Sistema Hostaway <noreply@resend.dev>",
      to: ["dgomezlimpatex@gmail.com"],
      subject: `🚨 Error en Sincronización Hostaway - ${scheduleName}`,
      html: generateErrorEmailHTML(error, scheduleName, retryAttempt, timestamp),
    });

    console.log("✅ Error notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("❌ Error in send-sync-error-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);