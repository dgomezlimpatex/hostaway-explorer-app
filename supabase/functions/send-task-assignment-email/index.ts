
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskAssignmentEmailRequest {
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
    const { taskId, cleanerEmail, cleanerName, taskData }: TaskAssignmentEmailRequest = await req.json();

    console.log('Sending task assignment email to:', cleanerEmail, 'for task:', taskId);

    // Format the date nicely in Spanish
    const taskDate = new Date(taskData.date);
    const formattedDate = taskDate.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestión <noreply@limpatex.com>",
      to: [cleanerEmail],
      subject: `Nueva Tarea Asignada - ${taskData.property}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2563eb; margin-bottom: 20px;">📋 Nueva Tarea Asignada</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${cleanerName}</strong>,</p>
            
            <p style="margin-bottom: 20px;">Se te ha asignado una nueva tarea de limpieza:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #374151; margin-top: 0; margin-bottom: 15px;">Detalles de la Tarea</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">🏠 Propiedad:</td>
                  <td style="padding: 8px 0; color: #111827;">${taskData.property}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">📍 Dirección:</td>
                  <td style="padding: 8px 0; color: #111827;">${taskData.address}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">📅 Fecha:</td>
                  <td style="padding: 8px 0; color: #111827;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">⏰ Horario:</td>
                  <td style="padding: 8px 0; color: #111827;">${taskData.startTime} - ${taskData.endTime}</td>
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
              <h4 style="color: #065f46; margin-top: 0; margin-bottom: 10px;">✅ Próximos Pasos:</h4>
              <ul style="color: #065f46; margin: 0; padding-left: 20px;">
                <li>Revisa los detalles de la tarea</li>
                <li>Confirma tu disponibilidad</li>
                <li>Prepara los materiales necesarios</li>
                <li>Llega puntual a la cita</li>
              </ul>
            </div>
            
            <p style="margin-bottom: 20px;">Si tienes alguna pregunta o necesitas modificar el horario, por favor contacta con tu supervisor.</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Este email fue enviado automáticamente por el Sistema de Gestión de Limpieza
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Task assignment email sent successfully:", emailResponse);

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
    console.error("Error sending task assignment email:", error);
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
