import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OneNightAlertRequest {
  reservationId: string;
  propertyName: string;
  guestName: string;
  arrivalDate: string;
  departureDate: string;
  accommodationId: string;
  status: string;
  adults: number;
  children?: number;
  notes?: string;
}

const formatSpanishDate = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: OneNightAlertRequest = await req.json();
    
    console.log(`🔔 Enviando alerta de reserva de 1 noche: ${body.reservationId} - ${body.propertyName}`);

    const guestCount = (body.adults || 0) + (body.children || 0);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#e65100,#ff6d00);padding:24px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;">⚡ Reserva de 1 Noche</h1>
              <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px;">Checkout mañana — Acción requerida</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="color:#333;font-size:15px;margin:0 0 20px;">
                Se ha detectado una <strong>nueva reserva de una sola noche</strong> con salida <strong>mañana</strong>. Revisa los detalles:
              </p>
              
              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff3e0;border-radius:8px;border:1px solid #ffe0b2;margin-bottom:20px;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#666;font-size:13px;width:140px;">🏠 Propiedad:</td>
                        <td style="padding:6px 0;color:#333;font-size:14px;font-weight:600;">${body.propertyName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#666;font-size:13px;">👤 Huésped:</td>
                        <td style="padding:6px 0;color:#333;font-size:14px;font-weight:600;">${body.guestName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#666;font-size:13px;">📅 Entrada:</td>
                        <td style="padding:6px 0;color:#333;font-size:14px;">${formatSpanishDate(body.arrivalDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#666;font-size:13px;">📅 Salida:</td>
                        <td style="padding:6px 0;color:#333;font-size:14px;font-weight:600;color:#e65100;">${formatSpanishDate(body.departureDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#666;font-size:13px;">👥 Huéspedes:</td>
                        <td style="padding:6px 0;color:#333;font-size:14px;">${body.adults} adulto${body.adults > 1 ? 's' : ''}${body.children ? ` + ${body.children} niño${body.children > 1 ? 's' : ''}` : ''}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#666;font-size:13px;">📋 Estado:</td>
                        <td style="padding:6px 0;color:#333;font-size:14px;">${body.status}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#666;font-size:13px;">🔑 Reserva ID:</td>
                        <td style="padding:6px 0;color:#333;font-size:14px;">${body.reservationId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${body.notes ? `
              <div style="background-color:#f5f5f5;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
                <p style="color:#666;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Notas</p>
                <p style="color:#333;font-size:14px;margin:0;">${body.notes}</p>
              </div>
              ` : ''}

              <p style="color:#888;font-size:12px;margin:20px 0 0;text-align:center;">
                Este email se ha generado automáticamente durante la sincronización de Avantio.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
              <p style="color:#999;font-size:11px;margin:0;">Limpatex Gestión — Sistema de alertas</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailResponse = await resend.emails.send({
      from: "Limpatex Alertas <alertas@limpatexgestion.com>",
      to: ["dgomezlimpatex@gmail.com"],
      subject: `⚡ Reserva 1 noche — ${body.propertyName} — Checkout ${formatSpanishDate(body.departureDate)}`,
      html,
    });

    console.log(`✅ Email de alerta enviado:`, emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse?.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ Error enviando alerta de 1 noche:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
