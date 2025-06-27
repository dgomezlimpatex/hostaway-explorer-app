
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

async function fetchHostawayReservationsByCheckout(token: string, startDate: string, endDate: string, offset: number = 0): Promise<HostawayReservation[]> {
  console.log(`📡 Obteniendo reservas por CHECKOUT desde ${startDate} hasta ${endDate}, offset: ${offset}`);
  
  const url = new URL(`${HOSTAWAY_API_BASE}/reservations`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());
  
  // SOLO por fecha de salida (checkout) - cuando necesitamos limpieza
  url.searchParams.append('departureStartDate', startDate);
  url.searchParams.append('departureEndDate', endDate);
  url.searchParams.append('includeResolved', 'true');
  url.searchParams.append('limit', '200');
  url.searchParams.append('offset', offset.toString());

  console.log(`📡 URL de consulta: ${url.toString()}`);

  const response = await makeApiRequest(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log(`📊 Respuesta de API: ${data.result?.length || 0} reservas encontradas`);
  return data.result || [];
}

export async function fetchAllHostawayReservations(token: string, startDate: string, endDate: string): Promise<HostawayReservation[]> {
  console.log(`🔍 BÚSQUEDA SIMPLIFICADA DE RESERVAS`);
  console.log(`📅 Período de checkout: ${startDate} hasta ${endDate} (HOY + 14 días)`);
  
  let allReservations: HostawayReservation[] = [];
  let offset = 0;
  let hasMore = true;

  // Buscar SOLO por fecha de checkout (cuando necesitamos limpieza)
  console.log(`📤 Buscando reservas que hacen CHECKOUT en el período...`);
  while (hasMore) {
    const reservations = await fetchHostawayReservationsByCheckout(token, startDate, endDate, offset);
    allReservations = allReservations.concat(reservations);
    
    console.log(`📊 Página ${Math.floor(offset/200) + 1}: ${reservations.length} reservas (total acumulado: ${allReservations.length})`);
    
    hasMore = reservations.length === 200;
    offset += 200;
  }

  console.log(`🎯 RESULTADO FINAL:`);
  console.log(`   - Total de reservas encontradas: ${allReservations.length}`);
  console.log(`   - Período buscado: ${startDate} a ${endDate}`);
  console.log(`   - Búsqueda: SOLO por fechas de CHECKOUT`);

  // Log detallado de estados
  console.log(`📋 Estados de reservas encontradas:`);
  const statusCounts = allReservations.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count} reservas`);
  });

  // Muestra de reservas para verificación
  console.log(`📋 Primeras 10 reservas encontradas:`);
  allReservations.slice(0, 10).forEach((r, i) => {
    console.log(`   ${i+1}. ID: ${r.id}, checkout: ${r.departureDate}, status: ${r.status}, listing: ${r.listingMapId}, guest: ${r.guestName}`);
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
