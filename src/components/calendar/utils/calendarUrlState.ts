import type { ViewType } from '@/types/calendar';
import type { TimelineZoom } from './timelineScale';

/**
 * Calendar context kept in the URL (?date=&view=&clients=&cleaners=&q=&zoom=)
 * so reloading, going back or sharing a link keeps the same day and filters.
 * Dates are civil dates in Europe/Madrid (YYYY-MM-DD).
 */
export interface CalendarUrlState {
  date?: string;
  view?: ViewType;
  clients: string[];
  cleaners: string[];
  q: string;
  zoom?: TimelineZoom;
  task?: string;
}

const VIEWS: ViewType[] = ['day', 'three-day', 'week'];
const ZOOMS: TimelineZoom[] = ['compact', 'normal', 'wide'];
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isValidCivilDate = (value: string) => {
  if (!CIVIL_DATE.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const list = (value: string | null) =>
  (value || '').split(',').map((item) => item.trim()).filter(Boolean);

export const parseCalendarUrlState = (params: URLSearchParams): CalendarUrlState => {
  const date = params.get('date') || '';
  const view = params.get('view') as ViewType | null;
  const zoom = params.get('zoom') as TimelineZoom | null;
  return {
    date: isValidCivilDate(date) ? date : undefined,
    view: view && VIEWS.includes(view) ? view : undefined,
    clients: list(params.get('clients')),
    cleaners: list(params.get('cleaners')),
    q: (params.get('q') || '').slice(0, 120),
    zoom: zoom && ZOOMS.includes(zoom) ? zoom : undefined,
    task: params.get('task') || undefined,
  };
};

const CONTEXT_KEYS = ['date', 'view', 'clients', 'cleaners', 'q', 'zoom'];

/** Copy of `params` without the given keys. */
export const withoutParams = (params: URLSearchParams, keys: string[]) =>
  new URLSearchParams(Array.from(params.entries()).filter(([key]) => !keys.includes(key)));

/**
 * Writes the calendar context into `params`, keeping unrelated parameters.
 * Defaults (Día, sin filtros, zoom normal) are left out to keep links short.
 */
export const writeCalendarUrlState = (
  params: URLSearchParams,
  state: { date: string; view: ViewType; clients: string[]; cleaners: string[]; q: string; zoom: TimelineZoom },
) => {
  const next = withoutParams(params, CONTEXT_KEYS);
  const set = (key: string, value: string | undefined) => {
    if (value) next.set(key, value);
  };
  set('date', state.date);
  set('view', state.view === 'day' ? undefined : state.view);
  set('clients', state.clients.join(','));
  set('cleaners', state.cleaners.join(','));
  set('q', state.q.trim());
  set('zoom', state.zoom === 'normal' ? undefined : state.zoom);
  return next;
};
