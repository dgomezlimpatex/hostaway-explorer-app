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
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'Fecha no disponible';
  }
};

// Maximum reservations to include in email to prevent oversized emails
const MAX_RESERVATIONS_IN_EMAIL = 100;

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

interface ReservationItem {
  clientName: string;
  propertyName: string;
  checkOutDate: string;
}

interface GroupedReservations {
  [clientName: string]: ReservationItem[];
}

// Batch fetch function to handle large ID sets (avoid PostgreSQL IN clause limits)
async function fetchInBatches<T>(
  table: string,
  column: string,
  ids: string[],
  selectFields: string,
  batchSize = 100
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .in(column, batchIds);
    
    if (error) {
      console.error(`Error fetching batch from ${table}:`, error);
      throw error;
    }
    
    if (data) {
      results.push(...(data as T[]));
    }
  }
  
  return results;
}

// Paginated fetch for logs to handle more than 1000 records
async function fetchAllLogs(startDate: string, endDate: string): Promise<ReservationLog[]> {
  const allLogs: ReservationLog[] = [];
  const pageSize = 500;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('client_reservation_logs')
      .select('id, client_id, reservation_id, new_data, created_at')
      .eq('action', 'created')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error("Error fetching logs page:", error);
      throw error;
    }
    
    if (data && data.length > 0) {
      allLogs.push(...(data as ReservationLog[]));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
    
    // Safety limit: max 5000 logs to prevent infinite loops
    if (allLogs.length >= 5000) {
      console.warn("⚠️ Reached safety limit of 5000 logs");
      break;
    }
  }
  
  return allLogs;
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

    // Fetch all logs with pagination
    const logs = await fetchAllLogs(threeHoursAgo.toISOString(), now.toISOString());

    console.log(`📋 Found ${logs.length} new reservations in the last 3 hours`);

    // If no new reservations, exit without sending email
    if (logs.length === 0) {
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
    const clientIds = [...new Set(logs.map(l => l.client_id).filter(Boolean))];
    const propertyIds = [...new Set(
      logs.map(l => (l.new_data as any)?.property_id).filter(Boolean)
    )];

    console.log(`📊 Unique clients: ${clientIds.length}, Unique properties: ${propertyIds.length}`);

    // Fetch clients and properties in batches
    const [clients, properties] = await Promise.all([
      fetchInBatches<{ id: string; nombre: string }>(
        'clients', 'id', clientIds, 'id, nombre'
      ),
      fetchInBatches<{ id: string; nombre: string; codigo: string }>(
        'properties', 'id', propertyIds, 'id, nombre, codigo'
      )
    ]);

    // Create lookup maps
    const clientMap = new Map(clients.map(c => [c.id, c.nombre]));
    const propertyMap = new Map(properties.map(p => [p.id, `${p.nombre} (${p.codigo})`]));

    // Build reservation list for email
    const reservationItems: ReservationItem[] = logs.map(log => {
      const clientName = clientMap.get(log.client_id) || 'Cliente desconocido';
      const propertyId = (log.new_data as any)?.property_id;
      const propertyName = propertyId 
        ? (propertyMap.get(propertyId) || 'Propiedad desconocida') 
        : 'Propiedad desconocida';
      const checkOutDate = (log.new_data as any)?.check_out_date;
      const formattedDate = checkOutDate ? formatSpanishDate(checkOutDate) : 'Fecha no disponible';

      return {
        clientName,
        propertyName,
        checkOutDate: formattedDate
      };
    });

    // Group reservations by client for better readability
    const groupedByClient: GroupedReservations = {};
    for (const item of reservationItems) {
      if (!groupedByClient[item.clientName]) {
        groupedByClient[item.clientName] = [];
      }
      groupedByClient[item.clientName].push(item);
    }

    // Sort clients alphabetically
    const sortedClients = Object.keys(groupedByClient).sort((a, b) => 
      a.localeCompare(b, 'es')
    );

    // Check if we need to truncate
    const totalReservations = reservationItems.length;
    const willTruncate = totalReservations > MAX_RESERVATIONS_IN_EMAIL;
    
    // Generate email HTML with grouped reservations
    let reservationHtml = '';
    let displayedCount = 0;
    
    for (const clientName of sortedClients) {
      if (displayedCount >= MAX_RESERVATIONS_IN_EMAIL) break;
      
      const clientReservations = groupedByClient[clientName];
      const remainingSlots = MAX_RESERVATIONS_IN_EMAIL - displayedCount;
      const reservationsToShow = clientReservations.slice(0, remainingSlots);
      
      reservationHtml += `
        <div class="client-group">
          <div class="client-header">${clientName} (${clientReservations.length})</div>
          ${reservationsToShow.map(item => `
            <div class="reservation-item">
              <span class="property-name">${item.propertyName}</span>
              <span class="checkout-date">Salida: ${item.checkOutDate}</span>
            </div>
          `).join('')}
          ${clientReservations.length > reservationsToShow.length 
            ? `<div class="more-items">... y ${clientReservations.length - reservationsToShow.length} más</div>` 
            : ''}
        </div>
      `;
      
      displayedCount += reservationsToShow.length;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nuevas Reservas del Portal de Clientes</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; }
          .summary { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 6px; padding: 12px; margin: 0 0 15px 0; text-align: center; }
          .client-group { background: white; border-radius: 6px; padding: 15px; margin-bottom: 10px; border: 1px solid #e5e5e5; }
          .client-header { font-weight: bold; color: #1d4ed8; font-size: 14px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #dbeafe; }
          .reservation-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
          .reservation-item:last-child { border-bottom: none; }
          .property-name { color: #555; flex: 1; }
          .checkout-date { color: #059669; font-weight: 500; white-space: nowrap; margin-left: 10px; }
          .more-items { color: #6b7280; font-style: italic; font-size: 12px; margin-top: 8px; }
          .truncation-notice { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px; margin-top: 15px; font-size: 12px; color: #92400e; }
          .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; text-align: center; }
          .stats { display: flex; justify-content: center; gap: 20px; margin-top: 10px; font-size: 12px; }
          .stat { text-align: center; }
          .stat-value { font-weight: bold; color: #1d4ed8; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Nuevas Reservas del Portal de Clientes</h1>
        </div>
        
        <div class="content">
          <div class="summary">
            <strong>Se han añadido ${totalReservations} reserva${totalReservations > 1 ? 's' : ''} en las últimas 3 horas</strong>
            <div class="stats">
              <div class="stat">
                <div class="stat-value">${sortedClients.length}</div>
                <div>Cliente${sortedClients.length > 1 ? 's' : ''}</div>
              </div>
              <div class="stat">
                <div class="stat-value">${propertyIds.length}</div>
                <div>Propiedad${propertyIds.length > 1 ? 'es' : ''}</div>
              </div>
            </div>
          </div>

          ${reservationHtml}
          
          ${willTruncate ? `
            <div class="truncation-notice">
              ⚠️ Se muestran las primeras ${MAX_RESERVATIONS_IN_EMAIL} reservas. 
              Total: ${totalReservations} reservas. 
              Consulta el sistema para ver todas.
            </div>
          ` : ''}
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
      subject: `📋 ${totalReservations} Nueva${totalReservations > 1 ? 's' : ''} Reserva${totalReservations > 1 ? 's' : ''} del Portal (${sortedClients.length} cliente${sortedClients.length > 1 ? 's' : ''})`,
      html: emailHtml,
    });

    console.log("✅ Reservation digest email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailResponse,
      reservationsCount: totalReservations,
      clientsCount: sortedClients.length,
      propertiesCount: propertyIds.length,
      truncated: willTruncate,
      message: `Email sent with ${totalReservations} reservations from ${sortedClients.length} clients`
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
