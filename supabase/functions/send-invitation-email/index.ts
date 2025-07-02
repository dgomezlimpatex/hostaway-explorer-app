
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  inviterName: string;
  role: string;
  token: string;
  appUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, inviterName, role, token, appUrl }: InvitationEmailRequest = await req.json();

    console.log(`Sending invitation email to ${email} for role ${role}`);

    const invitationUrl = `${appUrl}/accept-invitation?token=${token}&email=${encodeURIComponent(email)}`;

    const roleLabels: Record<string, string> = {
      admin: 'Administrador',
      manager: 'Manager',
      supervisor: 'Supervisor',
      cleaner: 'Limpiador/a',
      client: 'Cliente',
    };

    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestión <noreply@limpatexgestion.com>",
      to: [email],
      subject: `Invitación para unirse como ${roleLabels[role] || role}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">¡Has sido invitado!</h1>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #333; margin: 0;">
              <strong>${inviterName}</strong> te ha invitado a unirte al sistema de gestión con el rol de <strong>${roleLabels[role] || role}</strong>.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Aceptar Invitación
            </a>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>⚠️ Importante:</strong> Esta invitación expira en 7 días. Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:
            </p>
            <p style="word-break: break-all; color: #007bff; font-size: 12px; margin: 10px 0 0 0;">
              ${invitationUrl}
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            Si no esperabas esta invitación, puedes ignorar este email de forma segura.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation-email function:", error);
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
