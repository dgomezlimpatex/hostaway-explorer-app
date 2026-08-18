import { AvantioReservation } from './types.ts';

const API_BASE_URL = 'https://api.avantio.pro/pms/v1';
const MAX_RETRIES = 4;
const TIMEOUT_MS = 30000;
const FUTURE_DAYS = 30;
const MAX_PAGES = 100;
const PAGE_SIZE = 200;

export interface HttpGetOptions {
  retries?: number;
  timeoutMs?: number;
  deadlineAt?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface AvantioApiPayload {
  data?: unknown;
  _links?: { next?: string | null };
  meta?: unknown;
  _meta?: unknown;
  pagination?: unknown;
  [key: string]: unknown;
}

export interface AvantioFetchOptions {
  deadlineAt?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class AvantioSourceBudgetExceededError extends Error {}
class NonRetriableAvantioError extends Error {}

function requestLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

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

function norm(s: unknown): string {
  return String(s ?? '').trim();
}

export async function httpGet(
  url: string,
  headers: Record<string, string>,
  options: HttpGetOptions = {},
): Promise<AvantioApiPayload | null> {
  const retries = options.retries ?? MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const label = requestLabel(url);
  const budgetError = () => new AvantioSourceBudgetExceededError(
    `Global Avantio source budget exhausted before completing GET ${label}`,
  );

  for (let attempt = 1; attempt <= retries; attempt++) {
    const remainingMs = options.deadlineAt === undefined
      ? Number.POSITIVE_INFINITY
      : options.deadlineAt - Date.now();
    if (remainingMs <= 0) throw budgetError();

    const attemptTimeoutMs = Math.max(1, Math.min(timeoutMs, remainingMs));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);

    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (response.ok) {
        const text = await response.text();
        try { return JSON.parse(text); } catch { return null; }
      }

      const errorText = await response.text();
      const message = `API Error ${response.status}: ${errorText.slice(0, 400)}`;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new NonRetriableAvantioError(message);
      }
      throw new Error(message);
    } catch (error) {
      if (error instanceof NonRetriableAvantioError) throw error;

      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const deadlineExpired = options.deadlineAt !== undefined && Date.now() >= options.deadlineAt;
      if (deadlineExpired) throw budgetError();

      const finalError = isTimeout
        ? new Error(`Avantio request timed out after ${attempt} attempt${attempt === 1 ? '' : 's'} (${attemptTimeoutMs}ms last attempt): GET ${label}`)
        : error instanceof Error
          ? error
          : new Error(String(error));

      if (attempt >= retries) {
        if (isTimeout) {
          throw new Error(`Avantio request timed out after ${retries} attempts (${attemptTimeoutMs}ms last attempt): GET ${label}`);
        }
        throw finalError;
      }

      const waitTime = Math.pow(2, attempt) * 1000;
      if (options.deadlineAt !== undefined && Date.now() + waitTime >= options.deadlineAt) {
        throw budgetError();
      }
      console.log(
        isTimeout
          ? `⏱️ Timeout Avantio en ${label}; reintento ${attempt + 1}/${retries} en ${waitTime}ms`
          : `⏳ Error temporal Avantio en ${label}; reintento ${attempt + 1}/${retries} en ${waitTime}ms: ${finalError.message}`,
      );
      await sleep(waitTime);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Avantio request failed after ${retries} attempts: GET ${label}`);
}

interface AvantioAccommodationDetail {
  name?: string;
  legalName?: string;
  internalName?: string;
  [key: string]: unknown;
}

/**
 * Get accommodation detail directly. This endpoint remains healthy even when
 * Avantio's bookings service contains records that hang on detail requests.
 */
export async function getAccommodationDetail(
  token: string,
  accommodationId: string,
  options: HttpGetOptions = {},
): Promise<AvantioAccommodationDetail | null> {
  const url = `${API_BASE_URL}/accommodations/${encodeURIComponent(String(accommodationId))}`;
  const result = await httpGet(url, headersAvantio(token), options);
  const payload = result?.data ?? result;
  if (!payload || typeof payload !== 'object') return null;
  return payload as AvantioAccommodationDetail;
}

// Cache: accommodationId -> { name, internalName }
const accommodationCache: Map<string, { name: string; internalName: string }> = new Map();

/**
 * Resolve accommodation name for a given accommodationId.
 * Uses the accommodation endpoint directly and caches the result.
 */
async function resolveAccommodationInfo(
  token: string,
  accommodationId: string,
  options: AvantioFetchOptions,
): Promise<{ name: string; internalName: string }> {
  if (accommodationCache.has(accommodationId)) {
    return accommodationCache.get(accommodationId)!;
  }

  const accommodation = await getAccommodationDetail(token, accommodationId, {
    deadlineAt: options.deadlineAt,
    fetchImpl: options.fetchImpl,
    sleep: options.sleep,
  });
  const name = norm(accommodation?.name || accommodation?.legalName || '');
  const internalName = norm(accommodation?.internalName || accommodation?.name || '');

  const info = { name, internalName };
  accommodationCache.set(accommodationId, info);
  console.log(`🏠 Accommodation ${accommodationId} -> nombre="${name}", código="${internalName}"`);

  return info;
}

/**
 * Fetch the Avantio reservations needed by both operational flows:
 * - checkout window: keeps task creation/update coverage intact;
 * - arrival window: keeps future entries available for the admin next-entry card.
 *
 * The two API results are deduplicated by Avantio reservation ID. A future arrival
 * may be stored even when its checkout is outside the task horizon; the processor
 * separately decides whether a cleaning task is due now.
 */
export async function fetchAllAvantioReservations(
  token: string,
  options: AvantioFetchOptions = {},
): Promise<AvantioReservation[]> {
  const cleanToken = token.replace(/^["'\s]+|["'\s]+$/g, '');
  const today = todayISO();
  // Avantio's departureFrom appears exclusive, so include yesterday.
  const fromDate = addDaysISO(today, -1);
  const toDate = addDaysISO(today, FUTURE_DAYS);

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

  type QueryWindow = {
    label: 'checkout' | 'arrival';
    fromParam: 'departureFrom' | 'arrivalFrom';
    toParam: 'departureTo' | 'arrivalTo';
    fromDate: string;
    toDate: string;
  };

  const queryWindows: QueryWindow[] = [
    { label: 'checkout', fromParam: 'departureFrom', toParam: 'departureTo', fromDate, toDate },
    { label: 'arrival', fromParam: 'arrivalFrom', toParam: 'arrivalTo', fromDate, toDate },
  ];
  const rawItemsById = new Map<string, RawItem>();
  let totalPages = 0;
  let totalDiscarded = 0;

  console.log(`📅 Ventanas Avantio: checkout ${fromDate}→${toDate} y entradas ${fromDate}→${toDate}`);

  for (const window of queryWindows) {
    let nextUrl: string | null = `${API_BASE_URL}/bookings?limit=${PAGE_SIZE}&sort=arrivalDate&order=asc&${window.fromParam}=${window.fromDate}&${window.toParam}=${window.toDate}`;
    let pages = 0;

    console.log(`🔎 URL inicial (${window.label}): ${nextUrl}`);

    while (nextUrl && pages < MAX_PAGES) {
      pages++;
      totalPages++;
      console.log(`📄 Página ${pages} (${window.label}): ${nextUrl}`);

      const pageObj = await httpGet(nextUrl, headersAvantio(cleanToken), {
        deadlineAt: options.deadlineAt,
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
      });
      if (!pageObj) break;

      const list = pageObj.data || [];
      if (!Array.isArray(list) || list.length === 0) break;

      if (pages === 1) {
        console.log(`📋 Primer item keys (${window.label}): ${JSON.stringify(Object.keys(list[0]))}`);
        console.log(`📋 Meta de la respuesta: ${JSON.stringify(pageObj.meta || pageObj._meta || pageObj.pagination || {}).slice(0, 500)}`);
      }

      let pageInRange = 0;
      for (const item of list) {
        if (!item?.id) continue;

        const checkOut = formatDateSimple(item?.dates?.departure || item?.dates?.checkOut || '');
        const checkIn = formatDateSimple(item?.dates?.arrival || item?.dates?.checkIn || '');
        if (!checkOut || !checkIn) continue;

        const relevantDate = window.label === 'arrival' ? checkIn : checkOut;
        if (relevantDate < window.fromDate || relevantDate > window.toDate) {
          totalDiscarded++;
          continue;
        }

        pageInRange++;
        const id = String(item.id);
        if (!rawItemsById.has(id)) {
          rawItemsById.set(id, {
            id,
            accommodationId: String(item.accommodationId || ''),
            status: norm(item.status || ''),
            checkIn,
            checkOut,
            creationDate: formatDateSimple(item.creationDate || item.createdAt || ''),
            total: item.total || 0,
            currency: item.currency || 'EUR',
          });
        }
      }

      console.log(`   ↳ ${window.label}: ${pageInRange} reservas útiles`);
      nextUrl = pageObj?._links?.next || null;
    }

    if (pages >= MAX_PAGES) {
      console.log(`⚠️ Alcanzado límite máximo de ${MAX_PAGES} páginas en ventana ${window.label}`);
    }
  }

  const rawItems = Array.from(rawItemsById.values());
  console.log(`📊 Fase 1 completada: ${rawItems.length} reservas únicas (descartadas ${totalDiscarded}, ${totalPages} páginas)`);

  // Phase 2: Resolve accommodation names (one accommodation call per unique ID)
  const uniqueAccommodationIds = new Set(rawItems.map(r => r.accommodationId).filter(Boolean));
  console.log(`🏠 ${uniqueAccommodationIds.size} alojamientos únicos a resolver`);

  let detailCalls = 0;
  for (const accId of uniqueAccommodationIds) {
    try {
      await resolveAccommodationInfo(cleanToken, accId, options);
      detailCalls++;
    } catch (err) {
      if (err instanceof AvantioSourceBudgetExceededError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error resolviendo accommodation ${accId}: ${message}`);
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

  console.log(`✅ Paginación completada. Páginas=${totalPages} | Detail calls=${detailCalls} | Reservas=${reservations.length}`);
  return reservations;
}
