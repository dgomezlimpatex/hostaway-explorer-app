import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChangeItem {
  taskId: string;
  property: string;
  address?: string;
  type?: string;
  oldStartTime: string;
  oldEndTime: string;
  newStartTime: string;
  newEndTime: string;
}

interface BatchEmailRequest {
  cleanerEmail: string;
  cleanerName: string;
  date: string; // yyyy-MM-dd
  changes: ChangeItem[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { cleanerEmail, cleanerName, date, changes }: BatchEmailRequest = await req.json();

    if (!cleanerEmail || !changes || changes.length === 0) {
      return new Response(JSON.stringify({ error: "Missing data" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const rowsHtml = changes
      .map(
        (c) => `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #111827;">
            <strong>${c.property}</strong>
            ${c.address ? `<div style="font-size:12px;color:#6b7280;">${c.address}</div>` : ""}
            ${c.type ? `<div style="font-size:11px;color:#6b7280;font-style:italic;">${c.type}</div>` : ""}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #dc2626; text-decoration: line-through; white-space: nowrap;">
            ${c.oldStartTime} - ${c.oldEndTime}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; color: #16a34a; font-weight: bold; white-space: nowrap;">
            ${c.newStartTime} - ${c.newEndTime}
          </td>
        </tr>`
      )
      .join("");

    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestión <noreply@limpatexgestion.com>",
      to: [cleanerEmail],
      subject: `🔄 Reorganización de tu horario – ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #f59e0b; margin-bottom: 16px;">🔄 Reorganización de tu horario</h2>
            <p style="font-size: 16px; margin-bottom: 8px;">Hola <strong>${cleanerName}</strong>,</p>
            <p style="margin-bottom: 20px; color:#374151;">
              Se ha insertado una nueva tarea en tu agenda del <strong>${formattedDate}</strong> y, como consecuencia,
              ${changes.length === 1 ? "una de tus tareas se ha desplazado" : `${changes.length} de tus tareas se han desplazado`} a un horario posterior.
              Aquí tienes el detalle:
            </p>

            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th align="left" style="padding: 10px 8px; font-size: 12px; color: #4b5563; text-transform: uppercase;">Tarea</th>
                  <th align="left" style="padding: 10px 8px; font-size: 12px; color: #4b5563; text-transform: uppercase;">Antes</th>
                  <th align="left" style="padding: 10px 8px; font-size: 12px; color: #4b5563; text-transform: uppercase;">Ahora</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
              <h4 style="color: #065f46; margin-top: 0; margin-bottom: 10px;">✅ Importante</h4>
              <ul style="color: #065f46; margin: 0; padding-left: 20px;">
                <li>Revisa los nuevos horarios y actualiza tu agenda</li>
                <li>Si tienes algún conflicto, contacta inmediatamente con tu supervisor</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Este email fue enviado automáticamente por el Sistema de Gestión de Limpieza
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Batch reschedule email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending batch reschedule email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
