import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskDetailEmail {
  reservation_id: string;
  property_name: string;
  task_id: string;
  task_date: string;
  guest_name: string;
  accommodation_id: string;
  status: string;
}

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
    tasks_cancelled: number;
    tasks_modified: number;
    errors_count: number;
  };
  tasks_details?: TaskDetailEmail[];
  tasks_cancelled_details?: TaskDetailEmail[];
  tasks_modified_details?: TaskDetailEmail[];
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

const formatTaskDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      timeZone: 'Europe/Madrid',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const generateTaskRows = (tasks: TaskDetailEmail[], actionLabel: string, color: string): string => {
  if (!tasks || tasks.length === 0) return '';
  return tasks.map(t => `
    <tr>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e5e5e5; font-size: 13px;">${formatTaskDate(t.task_date)}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e5e5e5; font-size: 13px;">${t.property_name}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e5e5e5; font-size: 13px;">${t.guest_name || '-'}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #e5e5e5; font-size: 13px;">
        <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${actionLabel}</span>
      </td>
    </tr>
  `).join('');
};

const generateEmailHTML = (data: ErrorEmailRequest): string => {
  const formattedDate = formatSpanishDate(data.timestamp);
  const hasErrors = data.stats.errors_count > 0;
  const statusColor = !data.success ? '#dc2626' : hasErrors ? '#f59e0b' : '#16a34a';
  const statusText = !data.success ? 'FALLIDA' : hasErrors ? 'Completada con Errores' : 'Completada';
  const statusEmoji = !data.success ? '🚨' : hasErrors ? '⚠️' : '✅';

  const errorLines = data.errorDetails
    ? data.errorDetails.split('\n').filter(l => l.trim()).map(line => `<li style="margin: 4px 0; font-size: 13px;">${line}</li>`).join('')
    : '';

  // Build task summary table
  const allTaskRows = [
    generateTaskRows(data.tasks_details || [], 'Nueva', '#16a34a'),
    generateTaskRows(data.tasks_modified_details || [], 'Modificada', '#2563eb'),
    generateTaskRows(data.tasks_cancelled_details || [], 'Eliminada', '#dc2626'),
  ].join('');

  const hasTaskDetails = (data.tasks_details?.length || 0) + (data.tasks_modified_details?.length || 0) + (data.tasks_cancelled_details?.length || 0) > 0;

  const taskSummarySection = hasTaskDetails ? `
    <h3 style="margin: 20px 0 10px;">📋 Resumen de Tareas</h3>
    <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px 10px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #e5e5e5;">Fecha</th>
          <th style="padding: 8px 10px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #e5e5e5;">Piso</th>
          <th style="padding: 8px 10px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #e5e5e5;">Huésped</th>
          <th style="padding: 8px 10px; text-align: left; font-size: 12px; color: #666; border-bottom: 2px solid #e5e5e5;">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${allTaskRows}
      </tbody>
    </table>
  ` : '';

  const errorSection = hasErrors ? `
    <div class="error-box" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin: 15px 0;">
      <div style="color: #dc2626; font-weight: bold; margin-bottom: 10px;">Detalle de Errores (máx. 20):</div>
      <ul style="padding-left: 20px; margin: 10px 0;">
        ${errorLines}
      </ul>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Sincronización Avantio</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; }
      </style>
    </head>
    <body>
      <div style="background: linear-gradient(135deg, ${statusColor}, ${statusColor}dd); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1>${statusEmoji} Sincronización Avantio: ${statusText}</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">${formattedDate}</p>
      </div>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5;">
        <p><strong>${data.errorSummary}</strong></p>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0;">
          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${data.stats.tasks_created}</div>
            <div style="font-size: 12px; color: #666;">Nuevas</div>
          </div>
          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${data.stats.tasks_modified}</div>
            <div style="font-size: 12px; color: #666;">Modificadas</div>
          </div>
          <div style="background: white; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${data.stats.tasks_cancelled}</div>
            <div style="font-size: 12px; color: #666;">Eliminadas</div>
          </div>
        </div>

        ${taskSummarySection}

        ${errorSection}
      </div>
      
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center;">
        <p>Email enviado automáticamente por el sistema de gestión de limpieza.</p>
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

    console.log(`📧 Enviando email de sincronización Avantio: ${data.errorSummary}`);

    const hasErrors = data.stats.errors_count > 0;
    const statusEmoji = !data.success ? '🚨' : hasErrors ? '⚠️' : '✅';
    const statusText = !data.success ? 'FALLO' : hasErrors ? 'Errores' : 'OK';

    const tasksSummary = `${data.stats.tasks_created}↑ ${data.stats.tasks_modified}~ ${data.stats.tasks_cancelled}↓`;

    const emailResponse = await resend.emails.send({
      from: "Sistema Avantio <noreply@resend.dev>",
      to: ["dgomezlimpatex@gmail.com"],
      subject: `${statusEmoji} Avantio: ${statusText} | ${tasksSummary}${hasErrors ? ` | ${data.stats.errors_count} errores` : ''}`,
      html: generateEmailHTML(data),
    });

    console.log("✅ Email de sincronización Avantio enviado:", emailResponse);

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
