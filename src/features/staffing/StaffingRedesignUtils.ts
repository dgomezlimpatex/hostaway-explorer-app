import type { StaffingService, StaffingWorker } from './types';

export type ForecastScreen = 'summary' | 'week' | 'candidates';
export type ForecastPeriod = 'weekly' | 'monthly';

export const FORECAST_RESERVE_PERCENT = 20;
export const applyForecastReserve = (minutes: number): number => minutes * (1 + FORECAST_RESERVE_PERCENT / 100);

export interface ForecastPoint {
  key: string;
  label: string;
  secondaryLabel: string;
  workloadMinutes: number;
  forecastMinutes: number;
  capacityMinutes: number;
  deficitMinutes: number;
}

export interface ForecastWeeklyRow {
  week: string;
  label: string;
  dates: string;
  knownMinutes: number;
  forecastMinutes: number;
  capacityMinutes: number;
  balanceMinutes: number;
  status: 'covered' | 'deficit';
}

export interface ForecastDailyRow {
  date: string;
  taskCount: number;
  tourismMinutes: number;
  otherMinutes: number;
  travelMinutes: number;
  estimatedMinutes: number;
  workloadMinutes: number;
  forecastMinutes: number;
  capacityMinutes: number;
  balanceMinutes: number;
  deficitMinutes: number;
}

export interface ForecastCandidate {
  worker: StaffingWorker;
  group: 'titular' | 'suplentes' | 'backup' | 'otros';
  pendingMinutes: number;
  availabilityStart: number;
  availabilityEnd: number;
}

export interface ForecastCandidateGroup {
  key: ForecastCandidate['group'];
  number: number;
  title: string;
  description: string;
  candidates: ForecastCandidate[];
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function dateValue(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function formatHours(minutes: number, maximumFractionDigits = 1): string {
  if (!Number.isFinite(minutes)) return '—';
  return `${(minutes / 60).toLocaleString('es-ES', { maximumFractionDigits })} h`;
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return 'Sin duración';
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function formatClock(minutes: number): string {
  if (!Number.isFinite(minutes)) return '—';
  const rounded = Math.round(minutes);
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

export function formatDay(date: string, withWeekday = false): string {
  if (!date) return 'Sin fecha';
  const value = dateValue(date);
  const day = value.getUTCDate();
  const month = MONTHS[value.getUTCMonth()].slice(0, 3);
  return withWeekday ? `${DAYS[value.getUTCDay()]} ${day}` : `${day} ${month}`;
}

export function formatDateRange(from: string, to: string): string {
  if (!from || !to) return 'Sin rango';
  return `${formatDay(from)} – ${formatDay(to)} ${dateValue(to).getUTCFullYear()}`;
}

export function weekEnd(week: string): string {
  const date = dateValue(week);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

export function weekLabel(week: string): string {
  return `Semana ${formatDay(week)} – ${formatDay(weekEnd(week))}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
}

export function staffingServiceLabel(service: StaffingService): string {
  if (service.kind === 'checkout') return 'Limpieza de salida';
  if (service.kind === 'stay') return 'Limpieza durante estancia';
  return 'Limpieza general';
}

export function buildCandidateGroups(candidates: ForecastCandidate[]): ForecastCandidateGroup[] {
  const definitions: Omit<ForecastCandidateGroup, 'candidates'>[] = [
    { key: 'titular', number: 1, title: 'Titular', description: 'Personal habitual del edificio' },
    { key: 'suplentes', number: 2, title: 'Suplentes', description: 'Personal de reserva del edificio' },
    { key: 'backup', number: 3, title: 'Backup', description: 'Refuerzo disponible' },
    { key: 'otros', number: 4, title: 'Otros edificios', description: 'Personal disponible en otros edificios' },
  ];
  return definitions.map(definition => ({ ...definition, candidates: candidates.filter(candidate => candidate.group === definition.key) }));
}

export function centerPriority(worker: StaffingWorker, centerId: string): ForecastCandidate['group'] {
  const priority = worker.centerPriorities?.find(item => item.centerId === centerId)?.priority;
  if (priority !== undefined && priority < 20) return 'titular';
  if (priority !== undefined && priority < 30) return 'suplentes';
  if (priority !== undefined && priority < 90) return 'backup';
  if (worker.homeCenterIds.includes(centerId)) return 'suplentes';
  return 'otros';
}

export function mergeCandidateGroups(groups: ForecastCandidateGroup[]): ForecastCandidateGroup[] {
  return groups.map(group => ({ ...group, candidates: [...group.candidates].sort((a, b) => b.pendingMinutes - a.pendingMinutes || (a.availabilityEnd - a.availabilityStart) - (b.availabilityEnd - b.availabilityStart) || a.worker.name.localeCompare(b.worker.name, 'es')) }));
}
