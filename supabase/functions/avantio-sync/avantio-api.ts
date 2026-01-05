import { AvantioReservation, AvantioProperty } from './types.ts';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

/**
 * IMPORTANTE: Esta función requiere que configures los siguientes secretos en Supabase:
 * - AVANTIO_API_URL: URL base de la API de Avantio
 * - AVANTIO_API_KEY: API Key de autenticación
 * - AVANTIO_CLIENT_ID: (Opcional) Client ID si usa OAuth
 * - AVANTIO_CLIENT_SECRET: (Opcional) Client Secret si usa OAuth
 * 
 * Cuando tengas la documentación de la API, ajusta los endpoints y formato de autenticación.
 */

async function makeApiRequest(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      // Si es un error 4xx (excepto 429), no reintentar
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`API Error ${response.status}: ${await response.text()}`);
      }
      
      // Para errores 5xx o 429, reintentar
      if (attempt < retries) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`⏳ Reintentando en ${waitTime}ms... (intento ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏱️ Timeout en intento ${attempt}/${retries}`);
      } else {
        console.error(`❌ Error en intento ${attempt}/${retries}:`, error);
      }
      
      if (attempt === retries) {
        throw error;
      }
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Obtener token de autenticación de Avantio
 * NOTA: Ajustar según el tipo de autenticación que use la API
 */
export async function getAvantioToken(): Promise<string> {
  const apiKey = Deno.env.get('AVANTIO_API_KEY');
  const clientId = Deno.env.get('AVANTIO_CLIENT_ID');
  const clientSecret = Deno.env.get('AVANTIO_CLIENT_SECRET');
  const apiUrl = Deno.env.get('AVANTIO_API_URL');
  
  // Verificar que tenemos al menos la API key
  if (!apiKey) {
    throw new Error('AVANTIO_API_KEY no está configurada. Por favor, configura los secretos de Avantio.');
  }
  
  // Si usa OAuth, obtener token
  if (clientId && clientSecret && apiUrl) {
    console.log('🔐 Obteniendo token OAuth de Avantio...');
    
    const tokenUrl = `${apiUrl}/oauth/token`;
    const response = await makeApiRequest(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    
    const tokenData = await response.json();
    console.log('✅ Token OAuth obtenido');
    return tokenData.access_token;
  }
  
  // Si no usa OAuth, devolver la API key directamente
  return apiKey;
}

/**
 * Obtener reservas de Avantio filtradas por fecha de checkout
 * NOTA: Ajustar endpoint y parámetros según documentación de Avantio
 */
export async function fetchAvantioReservations(
  token: string, 
  startDate: string, 
  endDate: string, 
  offset: number = 0
): Promise<AvantioReservation[]> {
  const apiUrl = Deno.env.get('AVANTIO_API_URL');
  
  if (!apiUrl) {
    throw new Error('AVANTIO_API_URL no está configurada');
  }
  
  console.log(`📥 Obteniendo reservas de Avantio (offset: ${offset})...`);
  console.log(`📅 Rango de fechas: ${startDate} a ${endDate}`);
  
  // NOTA: Ajustar este endpoint según la documentación de Avantio
  // Este es un ejemplo genérico basado en APIs de channel managers similares
  const url = new URL(`${apiUrl}/bookings`);
  url.searchParams.set('checkout_from', startDate);
  url.searchParams.set('checkout_to', endDate);
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('limit', '100');
  
  const response = await makeApiRequest(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  const data = await response.json();
  
  // NOTA: Ajustar el mapeo según la estructura real de la respuesta de Avantio
  // Este mapeo es genérico y debe ser adaptado
  const reservations: AvantioReservation[] = (data.result || data.bookings || data.reservations || []).map((booking: any) => ({
    id: String(booking.id || booking.reservation_id || booking.booking_id),
    accommodationId: String(booking.accommodation_id || booking.property_id || booking.listing_id),
    accommodationName: booking.accommodation_name || booking.property_name || booking.listing_name,
    status: mapAvantioStatus(booking.status),
    arrivalDate: formatDate(booking.check_in || booking.arrival_date || booking.start_date),
    departureDate: formatDate(booking.check_out || booking.departure_date || booking.end_date),
    reservationDate: booking.created_at || booking.reservation_date,
    cancellationDate: booking.cancelled_at || booking.cancellation_date,
    nights: calculateNights(
      booking.check_in || booking.arrival_date,
      booking.check_out || booking.departure_date
    ),
    adults: booking.adults || booking.guest_count || 2,
    children: booking.children || 0,
    guestName: extractGuestName(booking),
    guestEmail: booking.guest_email || booking.email,
    totalAmount: booking.total_amount || booking.price,
    currency: booking.currency || 'EUR',
    notes: booking.notes || booking.special_requests
  }));
  
  console.log(`✅ Obtenidas ${reservations.length} reservas`);
  return reservations;
}

/**
 * Obtener todas las reservas paginando automáticamente
 */
export async function fetchAllAvantioReservations(
  token: string, 
  startDate: string, 
  endDate: string
): Promise<AvantioReservation[]> {
  let allReservations: AvantioReservation[] = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const reservations = await fetchAvantioReservations(token, startDate, endDate, offset);
    allReservations = [...allReservations, ...reservations];
    
    if (reservations.length < limit) {
      break; // No hay más páginas
    }
    
    offset += limit;
  }
  
  console.log(`📊 Total de reservas obtenidas: ${allReservations.length}`);
  return allReservations;
}

/**
 * Obtener propiedades/alojamientos de Avantio
 */
export async function fetchAvantioProperties(token: string): Promise<AvantioProperty[]> {
  const apiUrl = Deno.env.get('AVANTIO_API_URL');
  
  if (!apiUrl) {
    throw new Error('AVANTIO_API_URL no está configurada');
  }
  
  console.log('🏠 Obteniendo propiedades de Avantio...');
  
  // NOTA: Ajustar endpoint según documentación
  const url = `${apiUrl}/accommodations`;
  
  const response = await makeApiRequest(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  const properties: AvantioProperty[] = (data.result || data.accommodations || []).map((prop: any) => ({
    id: String(prop.id),
    name: prop.name,
    internalName: prop.internal_name || prop.reference
  }));
  
  console.log(`✅ Obtenidas ${properties.length} propiedades`);
  return properties;
}

// ============ FUNCIONES AUXILIARES ============

function mapAvantioStatus(status: string): string {
  // Mapear estados de Avantio a nuestro sistema
  const statusMap: Record<string, string> = {
    'confirmed': 'confirmed',
    'pending': 'pending',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'completed': 'confirmed',
    'checked_in': 'confirmed',
    'checked_out': 'confirmed',
    'no_show': 'cancelled'
  };
  
  return statusMap[status?.toLowerCase()] || status || 'pending';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Si ya está en formato YYYY-MM-DD, retornar
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Intentar parsear otros formatos
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return dateStr;
  }
  
  return date.toISOString().split('T')[0];
}

function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1;
  
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 1;
  }
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays || 1;
}

function extractGuestName(booking: any): string {
  // Intentar obtener el nombre del huésped de varios campos posibles
  if (booking.guest_name) return booking.guest_name;
  if (booking.guest?.name) return booking.guest.name;
  if (booking.customer_name) return booking.customer_name;
  if (booking.guest_first_name && booking.guest_last_name) {
    return `${booking.guest_first_name} ${booking.guest_last_name}`;
  }
  if (booking.first_name && booking.last_name) {
    return `${booking.first_name} ${booking.last_name}`;
  }
  if (booking.booker_name) return booking.booker_name;
  
  return 'Huésped Desconocido';
}
