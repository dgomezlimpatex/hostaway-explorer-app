
import { HostawayReservation, HostawayProperty } from './types.ts';

const HOSTAWAY_ACCOUNT_ID = 80687;
const HOSTAWAY_API_BASE = 'https://api.hostaway.com/v1';

export async function getHostawayToken(): Promise<string> {
  console.log('Obteniendo token de Hostaway...');
  
  const clientId = Deno.env.get('HOSTAWAY_CLIENT_ID');
  const clientSecret = Deno.env.get('HOSTAWAY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de Hostaway no configuradas');
  }

  const response = await fetch(`${HOSTAWAY_API_BASE}/accessTokens`, {
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

  if (!response.ok) {
    throw new Error(`Error obteniendo token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchHostawayReservations(token: string, startDate: string, endDate: string, offset: number = 0): Promise<HostawayReservation[]> {
  console.log(`📡 Obteniendo reservas de Hostaway desde ${startDate} hasta ${endDate}, offset: ${offset}`);
  
  const url = new URL(`${HOSTAWAY_API_BASE}/reservations`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());
  
  // MEJORAR: Usar tanto arrivalStartDate/arrivalEndDate como departureStartDate/departureEndDate
  // para capturar todas las reservas que podrían afectar el período
  url.searchParams.append('arrivalStartDate', startDate);
  url.searchParams.append('arrivalEndDate', endDate);
  url.searchParams.append('includeResolved', 'true');
  url.searchParams.append('limit', '200');
  url.searchParams.append('offset', offset.toString());

  console.log(`📡 URL de consulta: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo reservas: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

// Nueva función para obtener reservas por fecha de salida también
async function fetchHostawayReservationsByDeparture(token: string, startDate: string, endDate: string, offset: number = 0): Promise<HostawayReservation[]> {
  console.log(`📡 Obteniendo reservas por fecha de SALIDA desde ${startDate} hasta ${endDate}, offset: ${offset}`);
  
  const url = new URL(`${HOSTAWAY_API_BASE}/reservations`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());
  url.searchParams.append('departureStartDate', startDate);
  url.searchParams.append('departureEndDate', endDate);
  url.searchParams.append('includeResolved', 'true');
  url.searchParams.append('limit', '200');
  url.searchParams.append('offset', offset.toString());

  console.log(`📡 URL de consulta por salida: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo reservas por salida: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

export async function fetchAllHostawayReservations(token: string, startDate: string, endDate: string): Promise<HostawayReservation[]> {
  console.log(`🔍 INICIANDO búsqueda completa de reservas para el período ${startDate} a ${endDate}`);
  
  // Obtener reservas por fecha de llegada
  let arrivalReservations: HostawayReservation[] = [];
  let offset = 0;
  let hasMore = true;

  console.log(`📥 Buscando reservas por fecha de LLEGADA...`);
  while (hasMore) {
    const reservations = await fetchHostawayReservations(token, startDate, endDate, offset);
    arrivalReservations = arrivalReservations.concat(reservations);
    
    console.log(`📊 Obtenidas ${reservations.length} reservas por llegada en esta página (total: ${arrivalReservations.length})`);
    
    hasMore = reservations.length === 200;
    offset += 200;
  }

  // Obtener reservas por fecha de salida
  let departureReservations: HostawayReservation[] = [];
  offset = 0;
  hasMore = true;

  console.log(`📤 Buscando reservas por fecha de SALIDA...`);
  while (hasMore) {
    const reservations = await fetchHostawayReservationsByDeparture(token, startDate, endDate, offset);
    departureReservations = departureReservations.concat(reservations);
    
    console.log(`📊 Obtenidas ${reservations.length} reservas por salida en esta página (total: ${departureReservations.length})`);
    
    hasMore = reservations.length === 200;
    offset += 200;
  }

  // Combinar y deduplicar reservas
  const allReservationsMap = new Map<number, HostawayReservation>();
  
  // Añadir reservas por llegada
  arrivalReservations.forEach(reservation => {
    allReservationsMap.set(reservation.id, reservation);
  });
  
  // Añadir reservas por salida (puede sobrescribir si ya existe, pero eso está bien)
  departureReservations.forEach(reservation => {
    allReservationsMap.set(reservation.id, reservation);
  });

  const allReservations = Array.from(allReservationsMap.values());
  
  console.log(`🎯 RESUMEN DE BÚSQUEDA:`);
  console.log(`   - Reservas por llegada: ${arrivalReservations.length}`);
  console.log(`   - Reservas por salida: ${departureReservations.length}`);
  console.log(`   - Total después de deduplicar: ${allReservations.length}`);

  // Log detallado para el período específico que menciona el usuario
  const targetDate = '2025-06-14'; // sábado 14
  const targetReservations = allReservations.filter(r => 
    r.departureDate === targetDate || r.arrivalDate === targetDate
  );
  
  console.log(`🎯 RESERVAS ESPECÍFICAS PARA ${targetDate}:`);
  console.log(`   - Total encontradas: ${targetReservations.length}`);
  targetReservations.forEach(r => {
    console.log(`   - ID: ${r.id}, llegada: ${r.arrivalDate}, salida: ${r.departureDate}, status: ${r.status}, listing: ${r.listingMapId}, guest: ${r.guestName}`);
  });

  return allReservations;
}

export async function fetchHostawayProperties(token: string): Promise<HostawayProperty[]> {
  console.log('Obteniendo propiedades de Hostaway...');
  
  const url = new URL(`${HOSTAWAY_API_BASE}/listings`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo propiedades: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}
