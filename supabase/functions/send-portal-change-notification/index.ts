import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatSpanishDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

interface PortalChangeRequest {
  action: 'updated' | 'cancelled';
  clientName: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  oldCheckInDate?: string;
  oldCheckOutDate?: string;
  guestCount?: number;
  specialRequests?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const data: PortalChangeRequest = await req.json();
    const { action, clientName, propertyName, checkInDate, checkOutDate, oldCheckInDate, oldCheckOutDate, guestCount, specialRequests } = data;

    console.log(`Portal change notification: ${action} - ${clientName} - ${propertyName}`);

    const recipientEmail = 'dgomezlimpatex@gmail.com';

    let subject: string;
    let headerEmoji: string;
    let headerColor: string;
    let headerText: string;
    let changesHtml = '';

    if (action === 'cancelled') {
      subject = `❌ Reserva Cancelada - ${clientName} - ${propertyName}`;
      headerEmoji = '❌';
      headerColor = '#dc2626';
      headerText = 'Reserva Cancelada por el Cliente';
    } else {
      subject = `✏️ Reserva Modificada - ${clientName} - ${propertyName}`;
      headerEmoji = '✏️';
      headerColor = '#f59e0b';
      headerText = 'Reserva Modificada por el Cliente';

      if (oldCheckInDate && oldCheckInDate !== checkInDate) {
        changesHtml += `
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #dc2626;">Entrada anterior:</td>
            <td style="padding: 8px 12px; color: #dc2626; text-decoration: line-through;">${formatSpanishDate(oldCheckInDate)}</td>
          </tr>`;
      }
      if (oldCheckOutDate && oldCheckOutDate !== checkOutDate) {
        changesHtml += `
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #dc2626;">Salida anterior:</td>
            <td style="padding: 8px 12px; color: #dc2626; text-decoration: line-through;">${formatSpanishDate(oldCheckOutDate)}</td>
          </tr>`;
      }
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: ${headerColor}; margin-bottom: 20px;">${headerEmoji} ${headerText}</h2>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${headerColor};">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #4b5563;">👤 Cliente:</td>
                <td style="padding: 8px 12px; color: #111827; font-weight: bold;">${clientName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #4b5563;">🏠 Propiedad:</td>
                <td style="padding: 8px 12px; color: #111827;">${propertyName}</td>
              </tr>
              ${changesHtml}
              <tr style="background-color: ${action === 'cancelled' ? '#fef2f2' : '#dcfce7'};">
                <td style="padding: 8px 12px; font-weight: bold; color: ${action === 'cancelled' ? '#dc2626' : '#16a34a'};">📅 Entrada:</td>
                <td style="padding: 8px 12px; color: ${action === 'cancelled' ? '#dc2626' : '#16a34a'}; font-weight: bold;">${formatSpanishDate(checkInDate)}</td>
              </tr>
              <tr style="background-color: ${action === 'cancelled' ? '#fef2f2' : '#dcfce7'};">
                <td style="padding: 8px 12px; font-weight: bold; color: ${action === 'cancelled' ? '#dc2626' : '#16a34a'};">📅 Salida:</td>
                <td style="padding: 8px 12px; color: ${action === 'cancelled' ? '#dc2626' : '#16a34a'}; font-weight: bold;">${formatSpanishDate(checkOutDate)}</td>
              </tr>
              ${guestCount ? `
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #4b5563;">👥 Huéspedes:</td>
                <td style="padding: 8px 12px; color: #111827;">${guestCount}</td>
              </tr>` : ''}
              ${specialRequests ? `
              <tr>
                <td style="padding: 8px 12px; font-weight: bold; color: #4b5563;">📝 Notas:</td>
                <td style="padding: 8px 12px; color: #111827;">${specialRequests}</td>
              </tr>` : ''}
            </table>
          </div>
          
          ${action === 'cancelled' ? `
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <p style="color: #991b1b; margin: 0; font-weight: bold;">⚠️ La tarea de limpieza asociada ha sido eliminada del calendario.</p>
          </div>` : `
          <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
            <p style="color: #065f46; margin: 0; font-weight: bold;">✅ La tarea de limpieza en el calendario ha sido actualizada automáticamente.</p>
          </div>`}
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Notificación automática del Portal de Clientes - Sistema de Gestión Limpatex
            </p>
          </div>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestión <noreply@limpatexgestion.com>",
      to: [recipientEmail],
      subject,
      html: emailHtml,
    });

    console.log("Portal change notification sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending portal change notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
