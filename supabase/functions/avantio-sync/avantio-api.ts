import { AvantioReservation } from './types.ts';

const API_BASE_URL = 'https://api.avantio.pro/pms/v1';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;
const FUTURE_DAYS = 30;
const MAX_PAGES = 20;

function formatDateSimple(dateString: string | undefined | null): string {
  if (!dateString) return '';
  try { return String(dateString).split('T')[0]; } catch { return ''; }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(baseISO: string, deltaDays: number): string {
  const d = new Date(baseISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function headersAvantio(token: string): Record<string, string> {
  return {
    'accept': 'application/json',
    'X-Avantio-Auth': token
  };
}

function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays || 1;
}

function norm(s: any): string {
  return (s || '').toString().trim();
}

async function httpGet(url: string, headers: Record<string, string>, retries = MAX_RETRIES): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        try { return JSON.parse(text); } catch { return null; }
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText.slice(0, 400)}`);
      }

      if (attempt < retries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Reintentando en ${waitTime}ms... (intento ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏱️ Timeout en intento ${attempt}/${retries}`);
      } else if (attempt === retries) {
        throw error;
      }

      if (attempt < retries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Get booking detail - used only to resolve accommodation name for unknown accommodationIds
 */
async function getBookingDetail(token: string, bookingId: string): Promise<any> {
  const url = `${API_BASE_URL}/bookings/${encodeURIComponent(String(bookingId))}`;
  const result = await httpGet(url, headersAvantio(token));
  return result ? (result.data || result) : null;
}

// Cache: accommodationId -> { name, internalName }
const accommodationCache: Map<string, { name: string; internalName: string }> = new Map();

/**
 * Resolve accommodation name for a given accommodationId.
 * Uses cache to avoid duplicate detail calls.
 * Only makes a detail call for the FIRST booking with each unknown accommodationId.
 */
async function resolveAccommodationInfo(
  token: string, 
  accommodationId: string,
  sampleBookingId: string
): Promise<{ name: string; internalName: string }> {
  if (accommodationCache.has(accommodationId)) {
    return accommodationCache.get(accommodationId)!;
  }

  // Fetch ONE booking detail to get accommodation name
  const detail = await getBookingDetail(token, sampleBookingId);
  const name = norm(detail?.accommodation?.name || detail?.accommodation?.internalName || '');
  const internalName = norm(detail?.accommodation?.internalName || '');
  
  const info = { name, internalName };
  accommodationCache.set(accommodationId, info);
  console.log(`🏠 Accommodation ${accommodationId} -> nombre="${name}", código="${internalName}"`);
  
  return info;
}

/**
 * Fetch all relevant Avantio reservations using real PMS v1 API.
 * 
 * Strategy:
 * 1. Use departureFrom/departureTo to filter: today → today+30
 * 2. Extract dates from list (available in list response)
 * 3. Only make detail calls per unique accommodationId (cached) to get accommodation name
 */
export async function fetchAllAvantioReservations(token: string): Promise<AvantioReservation[]> {
  const cleanToken = token.replace(/^["'\s]+|["'\s]+$/g, '');
  const today = todayISO();
  // CRITICAL FIX: Use yesterday as departureFrom to ensure we catch same-day checkouts
  // The Avantio API's departureFrom appears to be exclusive (departure > from, not >=)
  const fromDate = addDaysISO(today, -1);
  const toDate = addDaysISO(today, FUTURE_DAYS);

  console.log(`📅 Rango checkout: ${fromDate} a ${toDate} (incluye ayer para capturar checkouts de hoy)`);

  // Phase 1: Collect all raw items from list (fast, no detail calls)
  interface RawItem {
    id: string;
    accommodationId: string;
    status: string;
    checkIn: string;
    checkOut: string;
    creationDate: string;
    total: number;
    currency: string;
  }

  const rawItems: RawItem[] = [];
  let nextUrl: string | null = `${API_BASE_URL}/bookings?limit=50&sort=creationDate&order=desc&departureFrom=${fromDate}&departureTo=${toDate}`;
  let pages = 0;

  while (nextUrl && pages < MAX_PAGES) {
    pages++;
    console.log(`📄 Página ${pages}: ${nextUrl}`);

    const pageObj = await httpGet(nextUrl, headersAvantio(cleanToken));
    if (!pageObj) break;

    const list = pageObj.data || [];
    if (!Array.isArray(list) || list.length === 0) break;

    if (pages === 1) {
      console.log(`📋 Primer item keys: ${JSON.stringify(Object.keys(list[0]))}`);
    }

    console.log(`📄 Página ${pages}: ${list.length} reservas`);

    for (const item of list) {
      if (!item?.id) continue;

      const checkOut = formatDateSimple(item?.dates?.departure || item?.dates?.checkOut || '');
      const checkIn = formatDateSimple(item?.dates?.arrival || item?.dates?.checkIn || '');
      
      if (!checkOut) continue;
      // Double-check range (API should filter but be safe)
      if (checkOut < fromDate || checkOut > toDate) continue;

      rawItems.push({
        id: String(item.id),
        accommodationId: String(item.accommodationId || ''),
        status: norm(item.status || ''),
        checkIn,
        checkOut,
        creationDate: formatDateSimple(item.creationDate || item.createdAt || ''),
        total: item.total || 0,
        currency: item.currency || 'EUR'
      });
    }

    nextUrl = pageObj?._links?.next || null;
  }

  if (pages >= MAX_PAGES) {
    console.log(`⚠️ Alcanzado límite máximo de ${MAX_PAGES} páginas`);
  }

  console.log(`📊 Fase 1 completada: ${rawItems.length} reservas en rango (${pages} páginas)`);

  // Phase 2: Resolve accommodation names (one detail call per unique accommodationId)
  const uniqueAccommodationIds = new Set(rawItems.map(r => r.accommodationId).filter(Boolean));
  console.log(`🏠 ${uniqueAccommodationIds.size} alojamientos únicos a resolver`);

  // Map accommodationId -> sample booking id (first booking with that accommodationId)
  const sampleBookingByAccommodation: Map<string, string> = new Map();
  for (const item of rawItems) {
    if (item.accommodationId && !sampleBookingByAccommodation.has(item.accommodationId)) {
      sampleBookingByAccommodation.set(item.accommodationId, item.id);
    }
  }

  // Resolve each unique accommodation (detail call only once per accommodation)
  let detailCalls = 0;
  for (const [accId, sampleBookingId] of sampleBookingByAccommodation.entries()) {
    try {
      await resolveAccommodationInfo(cleanToken, accId, sampleBookingId);
      detailCalls++;
    } catch (err) {
      console.error(`❌ Error resolviendo accommodation ${accId}: ${err.message}`);
      accommodationCache.set(accId, { name: '', internalName: '' });
      detailCalls++;
    }
  }

  console.log(`📊 Fase 2 completada: ${detailCalls} detail calls para ${uniqueAccommodationIds.size} alojamientos`);

  // Phase 3: Build reservations with resolved accommodation names
  const reservations: AvantioReservation[] = [];

  for (const item of rawItems) {
    const accInfo = accommodationCache.get(item.accommodationId) || { name: '', internalName: '' };

    reservations.push({
      id: item.id,
      accommodationId: item.accommodationId,
      accommodationName: accInfo.name,
      accommodationInternalName: accInfo.internalName,
      status: item.status,
      arrivalDate: item.checkIn,
      departureDate: item.checkOut,
      reservationDate: item.creationDate,
      cancellationDate: '',
      nights: calculateNights(item.checkIn, item.checkOut),
      adults: 2,
      children: 0,
      guestName: 'Huésped Desconocido',
      guestEmail: undefined,
      totalAmount: item.total,
      currency: item.currency,
      notes: ''
    });
  }

  console.log(`✅ Paginación completada. Páginas=${pages} | Detail calls=${detailCalls} | Reservas=${reservations.length}`);
  return reservations;
}
