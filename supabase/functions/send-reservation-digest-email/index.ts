import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatSpanishDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

interface ReservationLog {
  id: string;
  client_id: string;
  reservation_id: string;
  new_data: {
    property_id?: string;
    check_out_date?: string;
  } | null;
  created_at: string;
}

interface Client {
  id: string;
  nombre: string;
}

interface Property {
  id: string;
  nombre: string;
  codigo: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📧 Starting reservation digest email process...");

    // Calculate time window (last 3 hours)
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    console.log(`⏰ Time window: ${threeHoursAgo.toISOString()} to ${now.toISOString()}`);

    // Query reservation logs for created reservations in the last 3 hours
    const { data: logs, error: logsError } = await supabase
      .from('client_reservation_logs')
      .select('id, client_id, reservation_id, new_data, created_at')
      .eq('action', 'created')
      .gte('created_at', threeHoursAgo.toISOString())
      .lte('created_at', now.toISOString())
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error("❌ Error fetching reservation logs:", logsError);
      throw new Error(`Error fetching logs: ${logsError.message}`);
    }

    console.log(`📋 Found ${logs?.length || 0} new reservations in the last 3 hours`);

    // If no new reservations, exit without sending email
    if (!logs || logs.length === 0) {
      console.log("✅ No new reservations to report. Skipping email.");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No new reservations to report",
        reservationsCount: 0 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get unique client IDs and property IDs
    const clientIds = [...new Set(logs.map(l => l.client_id))];
    const propertyIds = [...new Set(logs.map(l => (l.new_data as any)?.property_id).filter(Boolean))];

    // Fetch clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, nombre')
      .in('id', clientIds);

    if (clientsError) {
      console.error("❌ Error fetching clients:", clientsError);
      throw new Error(`Error fetching clients: ${clientsError.message}`);
    }

    // Fetch properties
    const { data: properties, error: propertiesError } = await supabase
      .from('properties')
      .select('id, nombre, codigo')
      .in('id', propertyIds);

    if (propertiesError) {
      console.error("❌ Error fetching properties:", propertiesError);
      throw new Error(`Error fetching properties: ${propertiesError.message}`);
    }

    // Create lookup maps
    const clientMap = new Map((clients || []).map(c => [c.id, c.nombre]));
    const propertyMap = new Map((properties || []).map(p => [p.id, `${p.nombre} (${p.codigo})`]));

    // Build reservation list for email
    const reservationItems = logs.map(log => {
      const clientName = clientMap.get(log.client_id) || 'Cliente desconocido';
      const propertyId = (log.new_data as any)?.property_id;
      const propertyName = propertyId ? (propertyMap.get(propertyId) || 'Propiedad desconocida') : 'Propiedad desconocida';
      const checkOutDate = (log.new_data as any)?.check_out_date;
      const formattedDate = checkOutDate ? formatSpanishDate(checkOutDate) : 'Fecha no disponible';

      return {
        clientName,
        propertyName,
        checkOutDate: formattedDate
      };
    });

    // Generate email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nuevas Reservas del Portal de Clientes</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; }
          .reservation-list { background: white; border-radius: 6px; padding: 15px; margin: 15px 0; }
          .reservation-item { padding: 10px 0; border-bottom: 1px solid #eee; }
          .reservation-item:last-child { border-bottom: none; }
          .client-name { font-weight: bold; color: #1d4ed8; }
          .property-name { color: #555; }
          .checkout-date { color: #059669; font-weight: 500; }
          .summary { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: center; }
          .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Nuevas Reservas del Portal de Clientes</h1>
        </div>
        
        <div class="content">
          <div class="summary">
            <strong>Se han añadido ${reservationItems.length} reserva${reservationItems.length > 1 ? 's' : ''} en las últimas 3 horas</strong>
          </div>

          <div class="reservation-list">
            ${reservationItems.map(item => `
              <div class="reservation-item">
                <span class="client-name">${item.clientName}</span> - 
                <span class="property-name">${item.propertyName}</span> - 
                <span class="checkout-date">Salida: ${item.checkOutDate}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="footer">
          <p>Resumen automático del Sistema de Gestión Limpatex<br/>
          Este email fue generado automáticamente.</p>
        </div>
      </body>
      </html>
    `;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Sistema de Gestión <noreply@limpatexgestion.com>",
      to: ["dgomezlimpatex@gmail.com"],
      subject: `📋 ${reservationItems.length} Nueva${reservationItems.length > 1 ? 's' : ''} Reserva${reservationItems.length > 1 ? 's' : ''} del Portal de Clientes`,
      html: emailHtml,
    });

    console.log("✅ Reservation digest email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailResponse,
      reservationsCount: reservationItems.length,
      message: `Email sent with ${reservationItems.length} reservations`
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("❌ Error in send-reservation-digest-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
