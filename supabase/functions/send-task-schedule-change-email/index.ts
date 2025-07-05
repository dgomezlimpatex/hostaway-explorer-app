import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskScheduleChangeEmailRequest {
  taskId: string;
  cleanerEmail: string;
  cleanerName: string;
  taskData: {
    property: string;
    address: string;
    date: string;
    startTime: string;
    endTime: string;
    type?: string;
    notes?: string;
  };
  changes: {
    oldDate?: string;
    oldStartTime?: string;
    oldEndTime?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { taskId, cleanerEmail, cleanerName, taskData, changes }: TaskScheduleChangeEmailRequest = await req.json();

    console.log('Sending task schedule change email to:', cleanerEmail, 'for task:', taskId);

    // Format the dates nicely in Spanish
    const newTaskDate = new Date(taskData.date);
    const formattedNewDate = newTaskDate.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let formattedOldDate = '';
    if (changes.oldDate) {
      const oldTaskDate = new Date(changes.oldDate);
      formattedOldDate = oldTaskDate.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }

    // Build changes description
    let changesHtml = '';
    
    // Siempre mostrar la fecha anterior para contexto
    if (changes.oldDate) {
      changesHtml += `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #dc2626;">📅 Fecha anterior:</td>
          <td style="padding: 8px 0; color: #dc2626; ${changes.oldDate !== taskData.date ? 'text-decoration: line-through;' : ''}">${formattedOldDate}</td>
        </tr>
      `;
    }
    
    if (changes.oldStartTime && changes.oldStartTime !== taskData.startTime) {
      changesHtml += `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #dc2626;">⏰ Hora inicio anterior:</td>
          <td style="padding: 8px 0; color: #dc2626; text-decoration: line-through;">${changes.oldStartTime}</td>
        </tr>
      `;
    }
    if (changes.oldEndTime && changes.oldEndTime !== taskData.endTime) {
      changesHtml += `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #dc2626;">⏰ Hora fin anterior:</td>
          <td style="padding: 8px 0; color: #dc2626; text-decoration: line-through;">${changes.oldEndTime}</td>
        </tr>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestión <noreply@limpatexgestion.com>",
      to: [cleanerEmail],
      subject: `Cambio de Horario - ${taskData.property}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #f59e0b; margin-bottom: 20px;">🔄 Cambio de Horario de Tarea</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${cleanerName}</strong>,</p>
            
            <p style="margin-bottom: 20px;">Se ha modificado el horario de una de tus tareas de limpieza:</p>
            
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
              <h3 style="color: #92400e; margin-top: 0; margin-bottom: 15px;">📋 Detalles de la Tarea</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">🏠 Propiedad:</td>
                  <td style="padding: 8px 0; color: #111827;">${taskData.property}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">📍 Dirección:</td>
                  <td style="padding: 8px 0; color: #111827;">${taskData.address}</td>
                </tr>
                ${changesHtml}
                <tr style="background-color: #dcfce7;">
                  <td style="padding: 8px 0; font-weight: bold; color: #16a34a;">📅 Nueva fecha:</td>
                  <td style="padding: 8px 0; color: #16a34a; font-weight: bold;">${formattedNewDate}</td>
                </tr>
                <tr style="background-color: #dcfce7;">
                  <td style="padding: 8px 0; font-weight: bold; color: #16a34a;">⏰ Nuevo horario:</td>
                  <td style="padding: 8px 0; color: #16a34a; font-weight: bold;">${taskData.startTime} - ${taskData.endTime}</td>
                </tr>
                ${taskData.type ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">🔧 Tipo:</td>
                  <td style="padding: 8px 0; color: #111827;">${taskData.type}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            ${taskData.notes ? `
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
              <h4 style="color: #92400e; margin-top: 0; margin-bottom: 10px;">📝 Notas Importantes:</h4>
              <p style="color: #92400e; margin: 0;">${taskData.notes}</p>
            </div>
            ` : ''}
            
            <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
              <h4 style="color: #065f46; margin-top: 0; margin-bottom: 10px;">✅ Importante:</h4>
              <ul style="color: #065f46; margin: 0; padding-left: 20px;">
                <li>Por favor, anota el nuevo horario en tu agenda</li>
                <li>Confirma que puedes asistir en el nuevo horario</li>
                <li>Si tienes algún conflicto, contacta inmediatamente con tu supervisor</li>
              </ul>
            </div>
            
            <p style="margin-bottom: 20px;">Si tienes alguna pregunta o no puedes asistir en el nuevo horario, por favor contacta con tu supervisor lo antes posible.</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Este email fue enviado automáticamente por el Sistema de Gestión de Limpieza
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Task schedule change email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending task schedule change email:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);