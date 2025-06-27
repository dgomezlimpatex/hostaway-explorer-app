
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
  
  // Buscar por fecha de salida (checkout) que es cuando se necesita limpieza
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
  console.log(`📊 Respuesta de API: ${data.result?.length || 0} reservas en esta página`);
  return data.result || [];
}

async function fetchHostawayReservationsByArrival(token: string, startDate: string, endDate: string, offset: number = 0): Promise<HostawayReservation[]> {
  console.log(`📡 Obteniendo reservas por fecha de LLEGADA desde ${startDate} hasta ${endDate}, offset: ${offset}`);
  
  const url = new URL(`${HOSTAWAY_API_BASE}/reservations`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());
  
  // También buscar por fecha de llegada para capturar reservas que empiezan en el período
  url.searchParams.append('arrivalStartDate', startDate);
  url.searchParams.append('arrivalEndDate', endDate);
  url.searchParams.append('includeResolved', 'true');
  url.searchParams.append('limit', '200');
  url.searchParams.append('offset', offset.toString());

  console.log(`📡 URL de consulta por llegada: ${url.toString()}`);

  const response = await makeApiRequest(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log(`📊 Respuesta de API (llegadas): ${data.result?.length || 0} reservas en esta página`);
  return data.result || [];
}

export async function fetchAllHostawayReservations(token: string, startDate: string, endDate: string): Promise<HostawayReservation[]> {
  console.log(`🔍 INICIANDO búsqueda EXPANDIDA de reservas para el período ${startDate} a ${endDate}`);
  console.log(`📅 Período de búsqueda: ${startDate} hasta ${endDate}`);
  
  // Calcular el rango más amplio para asegurar que capturamos todas las reservas
  const searchStartDate = new Date(startDate);
  searchStartDate.setDate(searchStartDate.getDate() - 7); // 1 semana antes
  const searchEndDate = new Date(endDate);
  searchEndDate.setDate(searchEndDate.getDate() + 7); // 1 semana después
  
  const expandedStartDate = searchStartDate.toISOString().split('T')[0];
  const expandedEndDate = searchEndDate.toISOString().split('T')[0];
  
  console.log(`🔍 Rango expandido de búsqueda: ${expandedStartDate} hasta ${expandedEndDate}`);
  
  let allReservations: HostawayReservation[] = [];
  let offset = 0;
  let hasMore = true;

  // 1. Buscar por fecha de salida (checkout)
  console.log(`📤 Buscando reservas por fecha de SALIDA...`);
  while (hasMore) {
    const reservations = await fetchHostawayReservationsByDeparture(token, expandedStartDate, expandedEndDate, offset);
    allReservations = allReservations.concat(reservations);
    
    console.log(`📊 Obtenidas ${reservations.length} reservas por salida en esta página (total: ${allReservations.length})`);
    
    hasMore = reservations.length === 200;
    offset += 200;
  }

  // 2. Buscar por fecha de llegada (checkin) para capturar reservas adicionales
  console.log(`📥 Buscando reservas por fecha de LLEGADA...`);
  offset = 0;
  hasMore = true;
  while (hasMore) {
    const reservations = await fetchHostawayReservationsByArrival(token, expandedStartDate, expandedEndDate, offset);
    
    // Evitar duplicados comparando por ID
    const newReservations = reservations.filter(newRes => 
      !allReservations.some(existingRes => existingRes.id === newRes.id)
    );
    
    allReservations = allReservations.concat(newReservations);
    
    console.log(`📊 Obtenidas ${reservations.length} reservas por llegada (${newReservations.length} nuevas), total: ${allReservations.length}`);
    
    hasMore = reservations.length === 200;
    offset += 200;
  }

  // 3. Filtrar reservas que realmente necesitan limpieza en el período solicitado
  const relevantReservations = allReservations.filter(reservation => {
    const departureDate = new Date(reservation.departureDate);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Incluir reservas que salen en el período (necesitan limpieza)
    const needsCleaning = departureDate >= start && departureDate <= end;
    
    return needsCleaning;
  });

  console.log(`🎯 RESUMEN DE BÚSQUEDA EXPANDIDA:`);
  console.log(`   - Total de reservas encontradas: ${allReservations.length}`);
  console.log(`   - Reservas relevantes (necesitan limpieza): ${relevantReservations.length}`);
  console.log(`   - Período de limpieza solicitado: ${startDate} a ${endDate}`);
  console.log(`   - Rango de búsqueda usado: ${expandedStartDate} a ${expandedEndDate}`);

  // Log detallado para debugging
  console.log(`📋 Estados de reservas relevantes:`);
  const statusCounts = relevantReservations.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count} reservas`);
  });

  console.log(`📋 Muestra de reservas relevantes:`);
  relevantReservations.slice(0, 5).forEach(r => {
    console.log(`   - ID: ${r.id}, llegada: ${r.arrivalDate}, salida: ${r.departureDate}, status: ${r.status}, listing: ${r.listingMapId}, guest: ${r.guestName}`);
  });

  return relevantReservations;
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
