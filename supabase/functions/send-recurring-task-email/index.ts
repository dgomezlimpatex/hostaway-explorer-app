import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RecurringTaskEmailRequest {
  cleanerEmail: string;
  cleanerName: string;
  taskData: {
    property: string;
    address: string;
    date: string;
    startTime: string;
    endTime: string;
    type?: string;
    recurringTaskName: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };
}

const dayNames: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

function buildScheduleText(taskData: RecurringTaskEmailRequest['taskData']): string {
  const { frequency, interval, daysOfWeek, dayOfMonth } = taskData;
  if (!frequency) return '';

  if (frequency === 'daily') {
    return interval && interval > 1 ? `Cada ${interval} días` : 'Todos los días';
  }

  if (frequency === 'weekly') {
    const days = (daysOfWeek || []).sort().map(d => dayNames[d] || '').filter(Boolean).join(', ');
    const prefix = interval && interval > 1 ? `Cada ${interval} semanas` : 'Cada semana';
    return days ? `${prefix}: ${days}` : prefix;
  }

  if (frequency === 'monthly') {
    const prefix = interval && interval > 1 ? `Cada ${interval} meses` : 'Cada mes';
    return dayOfMonth ? `${prefix}, el día ${dayOfMonth}` : prefix;
  }

  return '';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { cleanerEmail, cleanerName, taskData }: RecurringTaskEmailRequest = await req.json();

    if (!cleanerEmail) {
      return new Response(JSON.stringify({ success: false, error: "No cleaner email provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log('📧 Sending recurring task email to:', cleanerEmail, 'for:', taskData.recurringTaskName);

    const taskDate = new Date(taskData.date);
    const formattedDate = taskDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const typeLabels: Record<string, string> = {
      'limpieza-airbnb': 'Limpieza Airbnb',
      'mantenimiento-airbnb': 'Mantenimiento Airbnb',
      'limpieza-general': 'Limpieza General',
      'limpieza-comunidades': 'Limpieza Comunidades',
      'limpieza-hotel': 'Limpieza Hotel',
      'limpieza-oficinas': 'Limpieza Oficinas',
      'servicio-extraordinario': 'Servicio Extraordinario',
    };
    const typeLabel = taskData.type ? (typeLabels[taskData.type] || taskData.type) : '';

    const scheduleText = buildScheduleText(taskData);

    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestión <noreply@limpatexgestion.com>",
      to: [cleanerEmail],
      subject: `🔄 Tarea Recurrente Programada - ${taskData.property}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #e5e7eb;">
            
            <!-- Header con badge recurrente -->
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #3B82F6; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
                🔄 TAREA RECURRENTE
              </div>
            </div>
            
            <h2 style="color: #1e293b; margin-bottom: 8px; text-align: center; font-size: 22px;">
              Nueva Tarea Programada
            </h2>
            <p style="color: #64748b; text-align: center; margin-bottom: 24px; font-size: 14px;">
              Generada automáticamente desde: <strong>${taskData.recurringTaskName}</strong>
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px; color: #334155;">
              Hola <strong>${cleanerName}</strong>,
            </p>
            
            <p style="margin-bottom: 20px; color: #475569;">
              Se ha generado una nueva tarea a partir de tu programación recurrente:
            </p>
            
            <!-- Detalles de la tarea -->
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; font-weight: 600; color: #475569; width: 40%; vertical-align: top;">🏠 Propiedad</td>
                  <td style="padding: 10px 0; color: #1e293b; font-weight: 500;">${taskData.property}</td>
                </tr>
                ${taskData.address ? `
                <tr>
                  <td style="padding: 10px 0; font-weight: 600; color: #475569; vertical-align: top;">📍 Dirección</td>
                  <td style="padding: 10px 0; color: #1e293b;">${taskData.address}</td>
                </tr>
                ` : ''}
                ${scheduleText ? `
                <tr>
                  <td style="padding: 10px 0; font-weight: 600; color: #475569; vertical-align: top;">📅 Días</td>
                  <td style="padding: 10px 0; color: #1e293b; font-weight: 500;">${scheduleText}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 10px 0; font-weight: 600; color: #475569;">⏰ Horario</td>
                  <td style="padding: 10px 0; color: #1e293b; font-weight: 500;">${taskData.startTime} - ${taskData.endTime}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: 600; color: #475569;">📆 Próxima fecha</td>
                  <td style="padding: 10px 0; color: #1e293b; text-transform: capitalize;">${formattedDate}</td>
                </tr>
                ${typeLabel ? `
                <tr>
                  <td style="padding: 10px 0; font-weight: 600; color: #475569;">🔧 Tipo</td>
                  <td style="padding: 10px 0; color: #1e293b;">${typeLabel}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- Recordatorio -->
            <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3B82F6;">
              <p style="color: #1e40af; margin: 0; font-size: 14px;">
                <strong>📌 Recuerda:</strong> Esta tarea se genera automáticamente según tu programación recurrente. 
                Si necesitas cambios, contacta con tu supervisor.
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">
              Si tienes alguna pregunta, no dudes en contactar con tu supervisor.
            </p>
            
            <!-- Footer -->
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                Este email fue enviado automáticamente por el Sistema de Gestión Limpatex
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("✅ Recurring task email sent successfully:", emailResponse);

    return new Response(JSON.stringify({
      success: true,
      messageId: emailResponse.data?.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Error sending recurring task email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
