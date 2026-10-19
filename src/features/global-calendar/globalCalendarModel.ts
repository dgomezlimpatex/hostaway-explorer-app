/**
 * Calendario global: modelo puro (sin red ni React).
 *
 * Reúne estancias de todas las fuentes de reservas y las limpiezas registradas
 * de una semana en Europe/Madrid. Nunca deduce que una propiedad esté libre o
 * limpia: sin reserva registrada no equivale a disponible, y una limpieza solo
 * figura como hecha cuando su tarea o su parte de trabajo lo registran.
 */
import { getCalendarTaskStatus, type CalendarProgressReport } from '@/utils/calendarTaskStatus';
import { formatMadridDate } from '@/utils/date';
import { shiftCivilDate } from '@/utils/madridCalendar';

// ---------------------------------------------------------------------------
// Fechas civiles (YYYY-MM-DD) y semanas de lunes a domingo
// ---------------------------------------------------------------------------

const CIVIL_DAY = /^\d{4}-\d{2}-\d{2}$/;

const isValidCivilDay = (value: string) => {
  if (!CIVIL_DAY.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/**
 * Fecha civil de una columna date (se conserva tal cual) o de un instante con
 * hora (se convierte a su día en Madrid). Devuelve null si no es interpretable.
 */
export function civilDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (isValidCivilDay(text)) return text;
  const prefix = text.slice(0, 10);
  // Una fecha imposible (p. ej. 30 de febrero) no se desplaza a otro día.
  if (CIVIL_DAY.test(prefix) && !isValidCivilDay(prefix)) return null;
  // Fecha con hora sin zona (p. ej. «2026-10-19 00:00:00»): la parte de fecha ya es civil.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) {
    return isValidCivilDay(prefix) ? prefix : null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatMadridDate(parsed);
}

/** Días entre dos fechas civiles (b - a), inmune al cambio horario. */
export const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Lunes de la semana que contiene `day`. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftCivilDate(day, weekday === 0 ? -6 : 1 - weekday);
}

/** Los siete días civiles de la semana que empieza en `monday`. */
export const weekDaysFrom = (monday: string) => Array.from({ length: 7 }, (_, index) => shiftCivilDate(monday, index));

/** Semana pedida en la URL (cualquier día válido) o la semana de hoy en Madrid. */
export function resolveWeekStart(param: string | null | undefined, today: string): string {
  const requested = param && isValidCivilDay(param) ? param : null;
  return mondayOf(requested ?? today);
}

// ---------------------------------------------------------------------------
// Reservas: clasificación, unificación y señales de incertidumbre
// ---------------------------------------------------------------------------

export type ReservationSource = 'portal' | 'avantio' | 'hostaway' | 'smoobu' | 'littleHotelier' | 'avirato';

export const SOURCE_LABEL: Record<ReservationSource, string> = {
  portal: 'Portal de cliente',
  avantio: 'Avantio',
  hostaway: 'Hostaway',
  smoobu: 'Smoobu',
  littleHotelier: 'Little Hotelier',
  avirato: 'Avirato',
};

export interface RawReservation {
  source: ReservationSource;
  /** Identificador de la fila en su tabla de origen. */
  sourceId: string;
  externalId?: string | null;
  propertyId: string;
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  status: string | null | undefined;
  taskId?: string | null;
  /** La fuente registra una fecha de cancelación. */
  cancelledAt?: string | null;
  /** Habitación o espacio del hotel, cuando la fuente lo indica. */
  room?: string | null;
}

export type ReservationKind = 'stay' | 'block' | 'cancelled';

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const CANCELLED_MARKERS = ['cancel', 'anulad', 'elimin', 'delet', 'no show', 'no_show', 'noshow', 'unavailable', 'unavaliable', 'rechaz', 'reject', 'declin'];
const BLOCK_MARKERS = ['bloque', 'block'];

/**
 * Misma lectura de estados que las sincronizaciones existentes: cancelada,
 * eliminada, no-show o «UNAVAILABLE» de Avantio no ocupan; Avirato marca los
 * bloqueos como «block». Cualquier otro estado se trata como estancia.
 */
export function classifyReservation(status: string | null | undefined, cancelledAt?: string | null): ReservationKind {
  if (cancelledAt) return 'cancelled';
  const normalized = normalizeText(status);
  if (CANCELLED_MARKERS.some((marker) => normalized.includes(marker))) return 'cancelled';
  if (BLOCK_MARKERS.some((marker) => normalized.includes(marker))) return 'block';
  return 'stay';
}

export interface StaySourceRef {
  source: ReservationSource;
  sourceId: string;
  externalId: string | null;
  status: string | null;
  room: string | null;
}

export type StayNote = 'overlap' | 'shared-task' | 'day-use';

export interface Stay {
  id: string;
  propertyId: string;
  kind: 'stay' | 'block';
  checkIn: string;
  checkOut: string;
  nights: number;
  sources: StaySourceRef[];
  taskIds: string[];
  notes: StayNote[];
}

export interface ReservationIssue {
  kind: 'invalid-dates';
  source: ReservationSource;
  sourceId: string;
  propertyId: string;
}

export interface MergedReservations {
  stays: Stay[];
  cancelled: number;
  issues: ReservationIssue[];
}

/**
 * Une las reservas de varias fuentes:
 * - una misma fila repetida (misma fuente e id) cuenta una vez;
 * - misma propiedad, mismo tipo y mismas fechas desde varias fuentes es la misma estancia;
 * - las canceladas no ocupan y no se dibujan;
 * - no se inventa una fusión: fechas distintas se conservan y se señalan si se solapan
 *   o si comparten la misma limpieza vinculada.
 */
export function mergeReservations(raws: RawReservation[]): MergedReservations {
  const seenRows = new Set<string>();
  const byInterval = new Map<string, Stay>();
  const stays: Stay[] = [];
  const issues: ReservationIssue[] = [];
  let cancelled = 0;

  for (const raw of raws) {
    const rowKey = `${raw.source}:${raw.sourceId}:${raw.propertyId}`;
    if (seenRows.has(rowKey)) continue;
    seenRows.add(rowKey);

    const kind = classifyReservation(raw.status, raw.cancelledAt);
    if (kind === 'cancelled') {
      cancelled += 1;
      continue;
    }
    const checkIn = civilDay(raw.checkIn);
    const checkOut = civilDay(raw.checkOut);
    if (!checkIn || !checkOut || checkOut < checkIn) {
      issues.push({ kind: 'invalid-dates', source: raw.source, sourceId: raw.sourceId, propertyId: raw.propertyId });
      continue;
    }

    const ref: StaySourceRef = {
      source: raw.source,
      sourceId: raw.sourceId,
      externalId: raw.externalId ?? null,
      status: raw.status ?? null,
      room: raw.room ?? null,
    };
    const intervalKey = `${raw.propertyId}|${kind}|${checkIn}|${checkOut}`;
    const existing = byInterval.get(intervalKey);
    if (existing) {
      existing.sources.push(ref);
      if (raw.taskId && !existing.taskIds.includes(raw.taskId)) existing.taskIds.push(raw.taskId);
      continue;
    }
    const stay: Stay = {
      id: `${raw.source}:${raw.sourceId}:${raw.propertyId}`,
      propertyId: raw.propertyId,
      kind,
      checkIn,
      checkOut,
      nights: dayDiff(checkIn, checkOut),
      sources: [ref],
      taskIds: raw.taskId ? [raw.taskId] : [],
      notes: checkIn === checkOut ? ['day-use'] : [],
    };
    byInterval.set(intervalKey, stay);
    stays.push(stay);
  }

  // Señales: estancias que se pisan en la misma propiedad y reservas distintas ligadas a la misma limpieza.
  const byProperty = new Map<string, Stay[]>();
  const byTask = new Map<string, Stay[]>();
  for (const stay of stays) {
    byProperty.set(stay.propertyId, [...(byProperty.get(stay.propertyId) ?? []), stay]);
    for (const taskId of stay.taskIds) byTask.set(taskId, [...(byTask.get(taskId) ?? []), stay]);
  }
  const addNote = (stay: Stay, note: StayNote) => {
    if (!stay.notes.includes(note)) stay.notes.push(note);
  };
  for (const list of byProperty.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a.checkIn < b.checkOut && b.checkIn < a.checkOut) {
          addNote(a, 'overlap');
          addNote(b, 'overlap');
        }
      }
    }
  }
  for (const list of byTask.values()) {
    if (list.length > 1) list.forEach((stay) => addNote(stay, 'shared-task'));
  }

  stays.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.checkOut.localeCompare(b.checkOut) || a.id.localeCompare(b.id));
  return { stays, cancelled, issues };
}

/** Noches de una estancia: entrada ≤ noche < salida. La noche de salida no está ocupada. */
export const occupiesNight = (stay: Pick<Stay, 'checkIn' | 'checkOut'>, day: string) => stay.checkIn <= day && day < stay.checkOut;

// ---------------------------------------------------------------------------
// Proyección semanal de estancias (medios días: la estancia va de mediodía a mediodía)
// ---------------------------------------------------------------------------

export const HALF_DAYS = 14;

export interface StaySegment {
  stay: Stay;
  /** Inicio y fin en medios días (0–14) dentro de la semana. */
  start: number;
  end: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export function projectStays(stays: Stay[], weekDays: string[]): { segments: StaySegment[]; lanes: number } {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const visible = stays.filter((stay) => stay.checkOut >= weekStart && stay.checkIn <= weekEnd);
  const segments: StaySegment[] = visible.map((stay) => {
    const dayUse = stay.checkIn === stay.checkOut;
    const continuesBefore = stay.checkIn < weekStart;
    const continuesAfter = stay.checkOut > weekEnd;
    const startIndex = dayDiff(weekStart, stay.checkIn);
    const endIndex = dayDiff(weekStart, stay.checkOut);
    const start = continuesBefore ? 0 : dayUse ? startIndex * 2 : startIndex * 2 + 1;
    const end = continuesAfter ? HALF_DAYS : dayUse ? endIndex * 2 + 2 : endIndex * 2 + 1;
    return { stay, start, end, lane: 0, continuesBefore, continuesAfter };
  });
  segments.sort((a, b) => a.start - b.start || b.end - a.end || a.stay.id.localeCompare(b.stay.id));
  const laneEnds: number[] = [];
  for (const segment of segments) {
    // Salida y entrada el mismo día se tocan a mediodía sin solaparse: comparten carril.
    let lane = laneEnds.findIndex((end) => end <= segment.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(segment.end);
    } else {
      laneEnds[lane] = segment.end;
    }
    segment.lane = lane;
  }
  return { segments, lanes: Math.max(1, laneEnds.length) };
}

// ---------------------------------------------------------------------------
// Limpiezas (tareas) y su estado registrado
// ---------------------------------------------------------------------------

export interface RawTask {
  id: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  type: string | null;
  propiedad_id: string | null;
  property: string | null;
  cleaner: string | null;
  task_assignments?: Array<{ cleaner_id: string | null; cleaner_name: string | null }> | null;
  task_reports?: Array<CalendarProgressReport & { overall_status?: string | null }> | null;
}

export type CleaningState = 'pending' | 'in-progress' | 'completed' | 'unknown';

export interface Cleaning {
  id: string;
  propertyId: string | null;
  propertyLabel: string;
  date: string;
  start: string | null;
  end: string | null;
  type: string | null;
  plannedStatus: string | null;
  state: CleaningState;
  needsReview: boolean;
  cleaners: string[];
  recordedStart: string | null;
  recordedEnd: string | null;
}

const hhmm = (value: string | null | undefined) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};

const validInstant = (value: string | null | undefined) => !!value && Number.isFinite(Date.parse(value));

export function toCleaning(raw: RawTask): Cleaning | null {
  const date = civilDay(raw.date);
  if (!date) return null;
  const assignments = raw.task_assignments ?? [];
  const reports = raw.task_reports ?? [];
  const assignedIds = assignments.map((assignment) => assignment.cleaner_id).filter((id): id is string => !!id);
  const display = getCalendarTaskStatus(raw.status ?? '', reports, assignedIds);
  const state: CleaningState = display === 'pending' || display === 'in-progress' || display === 'completed' ? display : 'unknown';
  const names = [...new Set(assignments.map((assignment) => assignment.cleaner_name?.trim()).filter((name): name is string => !!name))];
  if (!names.length && raw.cleaner?.trim()) names.push(raw.cleaner.trim());
  const starts = reports.map((report) => report.start_time).filter(validInstant) as string[];
  const ends = reports.map((report) => report.end_time).filter(validInstant) as string[];
  return {
    id: raw.id,
    propertyId: raw.propiedad_id,
    propertyLabel: raw.property?.trim() || 'Propiedad sin nombre',
    date,
    start: hhmm(raw.start_time),
    end: hhmm(raw.end_time),
    type: raw.type?.trim() || null,
    plannedStatus: raw.status,
    state,
    needsReview: reports.some((report) => report.overall_status === 'needs_review'),
    cleaners: names,
    recordedStart: starts.length ? starts.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b)) : null,
    recordedEnd: ends.length && state === 'completed' ? ends.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)) : null,
  };
}

const compareCleanings = (a: Cleaning, b: Cleaning) =>
  (a.start ?? '99:99').localeCompare(b.start ?? '99:99') || a.id.localeCompare(b.id);

// ---------------------------------------------------------------------------
// Semana por propiedad
// ---------------------------------------------------------------------------

export interface CalendarProperty {
  id: string;
  name: string;
  code: string;
  clientId: string | null;
  clientName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  isActive: boolean;
  defaultCheckIn: string | null;
  defaultCheckOut: string | null;
}

export type NightState = 'occupied' | 'blocked' | 'none' | 'unknown';

export interface PropertyDay {
  day: string;
  night: NightState;
  arrivals: Stay[];
  departures: Stay[];
  cleanings: Cleaning[];
  /** Hay una salida registrada y ninguna limpieza ese día en la propiedad. */
  departureWithoutCleaning: boolean;
}

export interface PropertyWeek {
  property: CalendarProperty;
  segments: StaySegment[];
  lanes: number;
  days: PropertyDay[];
  /** Las reservas de esta propiedad pueden estar incompletas (fuente no leída o truncada). */
  reservationsIncomplete: boolean;
}

export interface WeekSummary {
  properties: number;
  arrivals: number;
  departures: number;
  turnovers: number;
  cleanings: Record<CleaningState, number>;
  departuresWithoutCleaning: number;
}

export interface CalendarWeek {
  days: string[];
  rows: PropertyWeek[];
  /** Limpiezas de la sede sin propiedad vinculada o con una propiedad que no figura en el listado. */
  unplacedCleanings: Cleaning[];
  summary: WeekSummary;
}

export function buildWeek({
  weekDays,
  properties,
  stays,
  cleanings,
  isIncomplete,
}: {
  weekDays: string[];
  properties: CalendarProperty[];
  stays: Stay[];
  cleanings: Cleaning[];
  isIncomplete: (propertyId: string) => boolean;
}): CalendarWeek {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const knownIds = new Set(properties.map((property) => property.id));
  const staysByProperty = new Map<string, Stay[]>();
  for (const stay of stays) {
    if (!knownIds.has(stay.propertyId)) continue;
    staysByProperty.set(stay.propertyId, [...(staysByProperty.get(stay.propertyId) ?? []), stay]);
  }
  const cleaningsByProperty = new Map<string, Cleaning[]>();
  const unplacedCleanings: Cleaning[] = [];
  for (const cleaning of cleanings) {
    if (cleaning.date < weekStart || cleaning.date > weekEnd) continue;
    if (!cleaning.propertyId || !knownIds.has(cleaning.propertyId)) {
      unplacedCleanings.push(cleaning);
      continue;
    }
    cleaningsByProperty.set(cleaning.propertyId, [...(cleaningsByProperty.get(cleaning.propertyId) ?? []), cleaning]);
  }

  const summary: WeekSummary = {
    properties: 0,
    arrivals: 0,
    departures: 0,
    turnovers: 0,
    cleanings: { pending: 0, 'in-progress': 0, completed: 0, unknown: 0 },
    departuresWithoutCleaning: 0,
  };
  unplacedCleanings.forEach((cleaning) => {
    summary.cleanings[cleaning.state] += 1;
  });

  const rows: PropertyWeek[] = [];
  for (const property of properties) {
    const propertyStays = staysByProperty.get(property.id) ?? [];
    const propertyCleanings = (cleaningsByProperty.get(property.id) ?? []).slice().sort(compareCleanings);
    const { segments, lanes } = projectStays(propertyStays, weekDays);
    const hasActivity = segments.length > 0 || propertyCleanings.length > 0;
    // Las propiedades inactivas solo aparecen si tienen algo registrado esta semana.
    if (!property.isActive && !hasActivity) continue;
    const incomplete = isIncomplete(property.id);

    const days: PropertyDay[] = weekDays.map((day) => {
      const covering = propertyStays.filter((stay) => occupiesNight(stay, day));
      const night: NightState = covering.some((stay) => stay.kind === 'stay')
        ? 'occupied'
        : covering.some((stay) => stay.kind === 'block')
          ? 'blocked'
          : incomplete
            ? 'unknown'
            : 'none';
      const arrivals = propertyStays.filter((stay) => stay.kind === 'stay' && stay.checkIn === day);
      const departures = propertyStays.filter((stay) => stay.kind === 'stay' && stay.checkOut === day);
      const dayCleanings = propertyCleanings.filter((cleaning) => cleaning.date === day);
      const departureWithoutCleaning = departures.length > 0 && dayCleanings.length === 0;
      summary.arrivals += arrivals.length;
      summary.departures += departures.length;
      if (arrivals.length && departures.length) summary.turnovers += 1;
      if (departureWithoutCleaning) summary.departuresWithoutCleaning += 1;
      dayCleanings.forEach((cleaning) => {
        summary.cleanings[cleaning.state] += 1;
      });
      return { day, night, arrivals, departures, cleanings: dayCleanings, departureWithoutCleaning };
    });

    rows.push({ property, segments, lanes, days, reservationsIncomplete: incomplete });
  }
  summary.properties = rows.length;
  return { days: weekDays, rows, unplacedCleanings: unplacedCleanings.sort((a, b) => a.date.localeCompare(b.date) || compareCleanings(a, b)), summary };
}

// ---------------------------------------------------------------------------
// Búsqueda y agrupación
// ---------------------------------------------------------------------------

export type GroupMode = 'building' | 'client' | 'none';

export interface RowGroup {
  key: string;
  label: string;
  rows: PropertyWeek[];
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

const compareRows = (a: PropertyWeek, b: PropertyWeek) =>
  collator.compare(a.property.code || a.property.name, b.property.code || b.property.name) ||
  collator.compare(a.property.name, b.property.name) ||
  a.property.id.localeCompare(b.property.id);

export function filterRows(rows: PropertyWeek[], query: string): PropertyWeek[] {
  const needle = normalizeText(query);
  if (!needle) return rows;
  return rows.filter((row) => {
    const { property } = row;
    const haystack = [property.name, property.code, property.buildingName, property.clientName]
      .concat(row.days.flatMap((day) => day.cleanings.flatMap((cleaning) => cleaning.cleaners)))
      .map((value) => normalizeText(value))
      .join(' ');
    return haystack.includes(needle);
  });
}

export function groupRows(rows: PropertyWeek[], mode: GroupMode): RowGroup[] {
  if (mode === 'none') return rows.length ? [{ key: 'all', label: 'Todas las propiedades', rows: rows.slice().sort(compareRows) }] : [];
  const missingKey = '__none__';
  const groups = new Map<string, RowGroup>();
  for (const row of rows) {
    const id = mode === 'building' ? row.property.buildingId : row.property.clientId;
    const name = mode === 'building' ? row.property.buildingName : row.property.clientName;
    const key = id ?? missingKey;
    const label = id ? name || 'Sin nombre' : mode === 'building' ? 'Sin edificio asignado' : 'Sin cliente asignado';
    if (!groups.has(key)) groups.set(key, { key, label, rows: [] });
    groups.get(key)!.rows.push(row);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, rows: group.rows.sort(compareRows) }))
    .sort((a, b) => (a.key === missingKey ? 1 : 0) - (b.key === missingKey ? 1 : 0) || collator.compare(a.label, b.label));
}

// ---------------------------------------------------------------------------
// Formato en español (fechas civiles y horas de Madrid)
// ---------------------------------------------------------------------------

const civilFormatter = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-ES', { ...options, timeZone: 'UTC' });
const weekdayShort = civilFormatter({ weekday: 'short' });
const weekdayLong = civilFormatter({ weekday: 'long' });
const monthShort = civilFormatter({ month: 'short' });
const fullDate = civilFormatter({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);
const stripDot = (value: string) => value.replace(/\.$/, '');

export const formatWeekday = (day: string) => stripDot(weekdayShort.format(atNoon(day)));
export const formatWeekdayLong = (day: string) => weekdayLong.format(atNoon(day));
export const formatDayNumber = (day: string) => String(Number(day.slice(8, 10)));
export const formatMonthShort = (day: string) => stripDot(monthShort.format(atNoon(day)));
export const formatFullDate = (day: string) => fullDate.format(atNoon(day));
export const formatShortDate = (day: string) => `${formatWeekday(day)} ${formatDayNumber(day)} ${formatMonthShort(day)}`;

/** «19 – 25 oct 2026», «28 sept – 4 oct 2026» o «29 dic 2025 – 4 ene 2026». */
export function formatWeekRange(days: string[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const sameMonth = sameYear && first.slice(5, 7) === last.slice(5, 7);
  const left = sameMonth
    ? formatDayNumber(first)
    : `${formatDayNumber(first)} ${formatMonthShort(first)}${sameYear ? '' : ` ${first.slice(0, 4)}`}`;
  return `${left} – ${formatDayNumber(last)} ${formatMonthShort(last)} ${last.slice(0, 4)}`;
}

const madridTime = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Hora de Madrid de un instante registrado, con su día si no coincide con `onDay`. */
export function formatRecordedTime(instant: string | null, onDay?: string): string | null {
  if (!validInstant(instant)) return null;
  const date = new Date(instant as string);
  const time = madridTime.format(date);
  const day = formatMadridDate(date);
  return onDay && day !== onDay ? `${formatShortDate(day)}, ${time}` : time;
}

export const nightsLabel = (nights: number) => (nights === 1 ? '1 noche' : `${nights} noches`);

export const CLEANING_STATE_LABEL: Record<CleaningState, string> = {
  pending: 'Prevista',
  'in-progress': 'En curso',
  completed: 'Hecha',
  unknown: 'Estado sin reconocer',
};

export const NIGHT_STATE_LABEL: Record<NightState, string> = {
  occupied: 'Ocupado',
  blocked: 'Bloqueo',
  none: 'Sin reserva registrada',
  unknown: 'Dato no disponible',
};
