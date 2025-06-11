
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
  console.log(`Obteniendo reservas de Hostaway desde ${startDate} hasta ${endDate}, offset: ${offset}`);
  
  const url = new URL(`${HOSTAWAY_API_BASE}/reservations`);
  url.searchParams.append('accountId', HOSTAWAY_ACCOUNT_ID.toString());
  url.searchParams.append('arrivalStartDate', startDate);
  url.searchParams.append('arrivalEndDate', endDate);
  url.searchParams.append('includeResolved', 'true');
  url.searchParams.append('limit', '200');
  url.searchParams.append('offset', offset.toString());

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

export async function fetchAllHostawayReservations(token: string, startDate: string, endDate: string): Promise<HostawayReservation[]> {
  let allReservations: HostawayReservation[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const reservations = await fetchHostawayReservations(token, startDate, endDate, offset);
    allReservations = allReservations.concat(reservations);
    
    console.log(`📊 Obtenidas ${reservations.length} reservas en esta página (total: ${allReservations.length})`);
    
    hasMore = reservations.length === 200;
    offset += 200;
  }

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
