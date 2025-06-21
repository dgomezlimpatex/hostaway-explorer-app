
import { HostawayReservation, HostawayProperty } from './types.ts';

const HOSTAWAY_ACCOUNT_ID = 80687;
const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';
const REQUEST_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 segundo

async function makeApiRequest(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (retries > 0 && (error.name === 'AbortError' || error.message.includes('fetch'))) {
      console.log(`⚠️ Error en llamada API, reintentando... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return makeApiRequest(url, options, retries - 1);
    }
    
    throw error;
  }
}

export async function getHostawayToken(): Promise<string> {
  console.log('Obteniendo token de Hostaway...');
  
  const clientId = Deno.env.get('HOSTAWAY_CLIENT_ID');
  const clientSecret = Deno.env.get('HOSTAWAY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de Hostaway no configuradas');
  }

  const response = await makeApiRequest(`${HOSTAWAY_API_BASE}/accessTokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'general',
    }),
  });

  const data = await response.json();
  return data.access_token;
}

async function fetchHostawayReservationsByDeparture(token: string, startDate: string, endDate: string, offset: number = 0): Promise<HostawayReservation[]> {
  console.log(`📡 Obteniendo reservas por fecha de SALIDA desde ${startDate} hasta ${endDate}, offset: ${offset}`);
  
  const url = new URL(`${HOSTAWAY_API_BASE}/reservations`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());
  
  // CORREGIDO: Solo buscar por departureDate ya que es cuando se necesita limpieza
  url.searchParams.append('departureStartDate', startDate);
  url.searchParams.append('departureEndDate', endDate);
  url.searchParams.append('includeResolved', 'true');
  url.searchParams.append('limit', '200');
  url.searchParams.append('offset', offset.toString());

  console.log(`📡 URL de consulta por salida: ${url.toString()}`);

  const response = await makeApiRequest(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return data.result || [];
}

export async function fetchAllHostawayReservations(token: string, startDate: string, endDate: string): Promise<HostawayReservation[]> {
  console.log(`🔍 INICIANDO búsqueda OPTIMIZADA de reservas para el período ${startDate} a ${endDate}`);
  console.log(`✅ CORRECCIÓN APLICADA: Solo buscando por fecha de SALIDA (departureDate)`);
  
  // CORREGIDO: Solo obtener reservas por fecha de salida
  let allReservations: HostawayReservation[] = [];
  let offset = 0;
  let hasMore = true;

  console.log(`📤 Buscando reservas por fecha de SALIDA con timeouts y retry logic...`);
  while (hasMore) {
    const reservations = await fetchHostawayReservationsByDeparture(token, startDate, endDate, offset);
    allReservations = allReservations.concat(reservations);
    
    console.log(`📊 Obtenidas ${reservations.length} reservas por salida en esta página (total: ${allReservations.length})`);
    
    hasMore = reservations.length === 200;
    offset += 200;
  }

  console.log(`🎯 RESUMEN DE BÚSQUEDA OPTIMIZADA:`);
  console.log(`   - Solo búsqueda por fecha de salida: ${allReservations.length} reservas`);
  console.log(`   - Rango optimizado: ${startDate} a ${endDate}`);
  console.log(`   - Timeouts configurados: ${REQUEST_TIMEOUT}ms`);
  console.log(`   - Reintentos máximos: ${MAX_RETRIES}`);

  // Log detallado para debugging
  console.log(`📋 Muestra de reservas encontradas:`);
  allReservations.slice(0, 5).forEach(r => {
    console.log(`   - ID: ${r.id}, llegada: ${r.arrivalDate}, salida: ${r.departureDate}, status: ${r.status}, listing: ${r.listingMapId}, guest: ${r.guestName}`);
  });

  return allReservations;
}

export async function fetchHostawayProperties(token: string): Promise<HostawayProperty[]> {
  console.log('Obteniendo propiedades de Hostaway con timeouts...');
  
  const url = new URL(`${HOSTAWAY_API_BASE}/listings`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());

  const response = await makeApiRequest(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return data.result || [];
}
