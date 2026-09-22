import type { StaffingCenter, StaffingWorker } from './types';
import { addCivilDays, addCivilMonths, monthEnd } from './monthly';

export const RULES_VERSION = 'staffing-2026-09-22.1';
export type ForecastScreen = 'home' | 'forecast' | 'team' | 'shifts' | 'centers' | 'reports' | 'settings';
export interface ForecastContext { sedeId: string; month: string; horizon: number; week: string; center: string; scenario: 'known' | 'reserve'; asOf: string; reinforcementFrom?: string; reinforcementTo?: string }
export interface ForecastIssue { code: string; message: string; source: string; ids: string[]; impact: 'demand' | 'capacity' | 'ledger' | 'information'; date?: string; workerId?: string; centerId?: string }
export interface ForecastTask {
  id: string; propertyId: string; name: string; centerId: string; date: string;
  minutes: number; windowStart: number; windowEnd: number; start: number; end: number;
  workerId?: string; ambiguous: boolean; tourism: boolean; status: string;
}
export interface ForecastAbsence { id: string; workerId: string; from: string; to: string; type: string; start?: number; end?: number }
export interface ForecastWorker extends StaffingWorker { restDays: number[]; excluded: boolean; contractKnown: boolean }
export interface ForecastDataset {
  sedeId: string; from: string; to: string; fetchedAt: string; rulesVersion: string;
  centers: (StaffingCenter & { propertyCount: number })[]; workers: ForecastWorker[]; tasks: ForecastTask[];
  properties?: { id: string; name: string; centerId: string; minutes: number; windowStart: number; windowEnd: number }[];
  absences: ForecastAbsence[]; issues: ForecastIssue[];
  sources: { name: string; count: number; status: 'ready' | 'unavailable'; fetchedAt: string }[];
}
export interface ForecastPlacement { taskId: string; workerId: string; centerId: string; date: string; start: number; end: number; minutes: number; real: boolean }
export interface WorkerMonthLedger {
  workerId: string; month: string; target: number; adjustment: number; computed: number; future: number;
  tourism: number; other: number; proposed: number; missing: number;
  status: 'Cumple' | 'Faltan horas' | 'No verificable' | 'Sin jornada' | 'Excluido';
}
export interface ForecastDay { date: string; known: number; tourism: number; other: number; capacity: number; uncovered: number; unassigned: number; travel: number }
export interface ForecastPeriod extends Omit<ForecastDay, 'date'> { key: string; reserve: number; status: 'Cubierto' | 'Pendiente de encaje' | 'No verificable' | 'Sin demanda' }
export interface ForecastModel {
  context: ForecastContext; days: ForecastDay[]; weeks: ForecastPeriod[]; months: ForecastPeriod[];
  tasks: ForecastTask[]; placements: ForecastPlacement[]; ledgers: WorkerMonthLedger[]; issues: ForecastIssue[];
  rests: { workerId: string; date: string }[]; workers: ForecastWorker[]; visibleWorkerIds: string[];
}
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const monday = (date: string) => addCivilDays(date, -((weekday(date) + 6) % 7));
export const dates = (from: string, to: string) => { const result: string[] = []; for (let day = from; day <= to; day = addCivilDays(day, 1)) result.push(day); return result; };
export const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
export const madridNow = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(' ', 'T');
export const clock = (minute: number) => Number.isFinite(minute) ? `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}` : '—';
export const hours = (minutes: number) => Number.isFinite(minutes) ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(minutes / 60)} h` : '—';
export const dateLabel = (date: string) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`));
export const monthLabel = (month: string) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00Z`));
export function parseForecastContext(params: URLSearchParams, sedeId: string, asOf = madridNow()): ForecastContext {
  const monthValue = params.get('month') ?? asOf.slice(0, 7);
  const month = validDate(`${monthValue}-01`) ? monthValue : asOf.slice(0, 7);
  const horizon = [1, 3, 6].includes(Number(params.get('horizon'))) ? Number(params.get('horizon')) : 3;
  const weekValue = params.get('week') ?? `${month}-01`;
  const proposedWeek = monday(validDate(weekValue) ? weekValue : `${month}-01`);
  const firstWeek = monday(`${month}-01`), lastWeek = monday(monthEnd(addCivilMonths(`${month}-01`, horizon - 1)));
  const simFrom = params.get('simFrom') ?? '', simTo = params.get('simTo') ?? '';
  const simulation = validDate(simFrom) && validDate(simTo) && simFrom <= simTo && simFrom >= firstWeek && simTo <= addCivilDays(lastWeek, 6) ? { reinforcementFrom: simFrom, reinforcementTo: simTo } : {};
  return { sedeId, month, horizon, week: proposedWeek >= firstWeek && proposedWeek <= lastWeek ? proposedWeek : firstWeek, center: params.get('center') ?? '', scenario: params.get('scenario') === 'reserve' ? 'reserve' : 'known', asOf, ...simulation };
}
export function forecastLink(screen: ForecastScreen, context: ForecastContext, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ sede: context.sedeId, month: context.month, horizon: String(context.horizon), week: context.week, center: context.center, scenario: context.scenario, ...(context.reinforcementFrom ? { simFrom: context.reinforcementFrom, simTo: context.reinforcementTo! } : {}), ...extra });
  return `/staffing-forecast/screens/${screen}?${params}`;
}
export const monthDates = (month: string) => dates(`${month}-01`, monthEnd(`${month}-01`));
export const forecastQueryKey = (userId: string, sedeId: string, from: string, to: string) => ['staffing-snapshot', userId, sedeId, from, to, RULES_VERSION];
