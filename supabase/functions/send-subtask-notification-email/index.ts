import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubtaskNotificationRequest {
  taskId: string;
  cleanerId: string;
  subtask: {
    id: string;
    text: string;
    photoRequired: boolean;
    addedByName: string;
  };
  taskData: {
    property: string;
    address: string;
    date: string;
    startTime: string;
    endTime: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
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
    const { taskId, cleanerId, subtask, taskData }: SubtaskNotificationRequest = await req.json();

    console.log('Sending subtask notification for task:', taskId, 'to cleaner:', cleanerId);

    // Get cleaner email from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: cleaner, error: cleanerError } = await supabase
      .from('cleaners')
      .select('email, name')
      .eq('id', cleanerId)
      .single();

    if (cleanerError || !cleaner?.email) {
      console.log('No email found for cleaner:', cleanerId);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Cleaner email not found' 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Format the date nicely in Spanish
    const taskDate = new Date(taskData.date);
    const formattedDate = taskDate.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestión <noreply@limpatexgestion.com>",
      to: [cleaner.email],
      subject: `⚠️ Nueva Subtarea Añadida - ${taskData.property}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #ea580c; margin-bottom: 20px;">⚠️ Nueva Subtarea Añadida</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${cleaner.name}</strong>,</p>
            
            <p style="margin-bottom: 20px;">Se ha añadido una <strong>subtarea adicional</strong> a una de tus tareas de limpieza:</p>
            
            <!-- Task Info Box -->
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #374151; margin-top: 0; margin-bottom: 15px;">📋 Tarea Principal</h3>
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
              </table>
            </div>
            
            <!-- Subtask Highlight Box -->
            <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ea580c;">
              <h4 style="color: #c2410c; margin-top: 0; margin-bottom: 10px;">📌 Subtarea a Realizar:</h4>
              <p style="color: #9a3412; font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">
                ${subtask.text}
              </p>
              ${subtask.photoRequired ? `
              <div style="display: inline-block; background-color: #fed7aa; padding: 5px 10px; border-radius: 4px; margin-top: 5px;">
                <span style="color: #9a3412; font-size: 12px;">📷 Requiere foto como evidencia</span>
              </div>
              ` : ''}
              <p style="color: #78350f; font-size: 12px; margin-top: 10px; margin-bottom: 0;">
                Añadida por: ${subtask.addedByName}
              </p>
            </div>
            
            <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
              <h4 style="color: #065f46; margin-top: 0; margin-bottom: 10px;">✅ ¿Qué debes hacer?</h4>
              <ul style="color: #065f46; margin: 0; padding-left: 20px;">
                <li>Revisa la subtarea antes de ir a la limpieza</li>
                <li>Completa la subtarea durante tu visita</li>
                ${subtask.photoRequired ? '<li>Toma una foto como evidencia</li>' : ''}
                <li>Marca como completada en la app</li>
              </ul>
            </div>
            
            <p style="margin-bottom: 20px; color: #6b7280;">
              Esta subtarea aparecerá destacada en tu checklist cuando vayas a realizar la tarea.
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Este email fue enviado automáticamente por el Sistema de Gestión de Limpieza
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Subtask notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending subtask notification email:", error);
    return new Response(
      JSON.stringify({ error: error.message, details: error.toString() }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
