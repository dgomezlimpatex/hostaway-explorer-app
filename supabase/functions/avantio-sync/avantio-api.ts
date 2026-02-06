import { AvantioReservation } from './types.ts';

const API_BASE_URL = 'https://api.avantio.pro/pms/v1';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;
const PAST_DAYS = 10;
const FUTURE_DAYS = 30;
const CREATION_CUTOFF_DAYS = 120;

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

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
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

      // 4xx (except 429) - don't retry
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText.slice(0, 400)}`);
      }

      // 5xx or 429 - retry with backoff
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
 * Get booking detail from Avantio API
 */
async function getBookingDetail(token: string, bookingId: string): Promise<any> {
  const url = `${API_BASE_URL}/bookings/${encodeURIComponent(String(bookingId))}`;
  const result = await httpGet(url, headersAvantio(token));
  return result ? (result.data || result) : null;
}

/**
 * Extract checkout date from list item (some list responses include it)
 */
function getCheckOutFromList(item: any): string {
  return formatDateSimple(
    item?.dates?.departure ||
    item?.dates?.checkOut ||
    item?.departureDate ||
    item?.checkOut
  );
}

/**
 * Extract creation date from list item
 */
function getCreationFromList(item: any): string {
  return formatDateSimple(item?.creationDate || item?.createdAt || '');
}

/**
 * Extract check-in from detail
 */
function getCheckIn(detail: any): string {
  return formatDateSimple(detail.dates?.arrival || detail.dates?.checkIn || detail.dates?.start || '');
}

/**
 * Extract check-out from detail
 */
function getCheckOut(detail: any): string {
  return formatDateSimple(detail.dates?.departure || detail.dates?.checkOut || detail.dates?.end || '');
}

/**
 * Normalize string
 */
function norm(s: any): string {
  return (s || '').toString().trim();
}

/**
 * Fetch all relevant Avantio reservations using real PMS v1 API.
 * Paginates through bookings list, fetches detail for each,
 * and filters by checkout date range.
 */
export async function fetchAllAvantioReservations(token: string): Promise<AvantioReservation[]> {
  const today = todayISO();
  const fromDate = addDaysISO(today, -PAST_DAYS);
  const toDate = addDaysISO(today, FUTURE_DAYS);
  const creationCutoff = daysAgoISO(CREATION_CUTOFF_DAYS);

  console.log(`📅 Rango checkout: ${fromDate} a ${toDate} | Corte creación: ${creationCutoff}`);

  const reservations: AvantioReservation[] = [];
  let nextUrl: string | null = `${API_BASE_URL}/bookings?limit=50&sort=creationDate&order=desc`;
  let pages = 0;
  let detailCalls = 0;
  let stopPagination = false;

  while (nextUrl) {
    pages++;
    console.log(`📄 Página ${pages}: ${nextUrl}`);

    const pageObj = await httpGet(nextUrl, headersAvantio(token));
    if (!pageObj) break;

    const list = pageObj.data || [];
    if (!Array.isArray(list) || list.length === 0) break;

    console.log(`📄 Página ${pages}: ${list.length} reservas en listado`);

    for (const item of list) {
      if (!item?.id) continue;

      // Cut pagination by creation date
      const created = getCreationFromList(item);
      if (created && created < creationCutoff) {
        stopPagination = true;
        break;
      }

      // Pre-filter by checkout if available in list
      const listCheckOut = getCheckOutFromList(item);
      if (listCheckOut) {
        if (listCheckOut < fromDate || listCheckOut > toDate) {
          continue;
        }
      }

      // Fetch detail
      const detail = await getBookingDetail(token, item.id);
      detailCalls++;
      if (!detail) continue;

      const bookingId = String(detail.id);
      const status = norm(detail.status || '');
      const accommodationName = norm(detail.accommodation?.name || detail.accommodation?.internalName || '');
      const accommodationInternalName = norm(detail.accommodation?.internalName || '');

      const checkIn = getCheckIn(detail);
      const checkOut = getCheckOut(detail);
      if (!checkOut) continue;

      // Final filter by checkout range
      if (checkOut < fromDate || checkOut > toDate) continue;

      const reservation: AvantioReservation = {
        id: bookingId,
        accommodationId: String(detail.accommodation?.id || item.accommodationId || ''),
        accommodationName: accommodationName,
        accommodationInternalName: accommodationInternalName,
        status: status,
        arrivalDate: checkIn,
        departureDate: checkOut,
        reservationDate: formatDateSimple(detail.creationDate || detail.createdAt),
        cancellationDate: formatDateSimple(detail.cancellationDate || detail.cancelledAt),
        nights: calculateNights(checkIn, checkOut),
        adults: detail.guests?.adults || detail.adults || 2,
        children: detail.guests?.children || detail.children || 0,
        guestName: norm(detail.customer?.name || detail.guest?.name || detail.guestName || 'Huésped Desconocido'),
        guestEmail: detail.customer?.email || detail.guest?.email || detail.guestEmail,
        totalAmount: detail.price?.total || detail.totalAmount || 0,
        currency: detail.price?.currency || detail.currency || 'EUR',
        notes: detail.remarks || detail.notes || ''
      };

      reservations.push(reservation);
    }

    if (stopPagination) {
      console.log(`⛔ Stop paginación: creationDate < ${creationCutoff}`);
      break;
    }

    nextUrl = pageObj?._links?.next || null;
  }

  console.log(`✅ Paginación completada. Páginas=${pages} | Detalle calls=${detailCalls} | Reservas en rango=${reservations.length}`);
  return reservations;
}
