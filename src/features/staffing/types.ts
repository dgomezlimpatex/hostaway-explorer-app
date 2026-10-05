// Read-only forecast contracts. Minutes always mean person-minutes unless labelled clock time.
export interface StaffingCenter { id: string; name: string; startMinute: number; endMinute: number }
export interface StaffingService {
  id: string; centerId: string; date: string; personMinutes: number;
  startMinute: number; endMinute: number; requiredWorkers: number;
  source: 'task' | 'reservation' | 'recurring'; receivedDate?: string;
  kind: 'checkout' | 'stay' | 'fixed';
}
export interface StaffingAvailability { day: number; startMinute: number; endMinute: number }
export interface StaffingWorker {
  /** Missing means employee (legacy). Collaboration capacity is not a labour contract. */
  engagement?: 'employee' | 'collaborator';
  id: string; name: string;
  /** Employee contract budget, or collaborator operational availability budget; never a service price. */
  weeklyMinutes: number;
  /** Tope de asignación semanal (jornada comprometida + 30 % como máximo, regla de Dani). Si falta, se usa weeklyMinutes. */
  weeklyMinutesMax?: number; homeCenterIds: string[];
  /** Prioridad explícita por centro: 0–19 titular, 20–29 suplente, 30–89 backup. */
  centerPriorities?: { centerId: string; priority: number }[];
  availability: StaffingAvailability[]; restDay: number | null; flexibleRest: boolean;
  canMove: boolean; unavailableDates: string[]; confirmedRestDates: string[];
  activeFrom?: string; activeTo?: string;
  /** Employee payroll only. Ignored for collaborators: service pricing is unconfirmed. */
  costPerHour?: number;
  excludedCenterIds?: string[];
  blockedSlots?: { date?: string; day?: number; startMinute: number; endMinute: number; consumesContract: boolean }[];
  maxDailyMinutes?: number;
}
export interface StaffingIssue { code: string; message: string; centerId?: string }
export interface StaffingInventoryMonth { month: string; tasks: number; completed: number; missingDuration: number }
export interface StaffingProviderCoverage {
  provider: 'avantio' | 'lh' | 'avirato';
  label: string;
  referenceDate: string;
  reservations30: number;
  reservations31to60: number;
  latestDate?: string;
  status: 'extended' | 'one-month' | 'limited' | 'none' | 'unknown';
}
export interface StaffingDataset {
  centers: StaffingCenter[]; workers: StaffingWorker[]; services: StaffingService[];
  issues: StaffingIssue[]; inventory: StaffingInventoryMonth[]; providerCoverage?: StaffingProviderCoverage[]; fetchedAt: string;
}
export interface StaffingOptions {
  dateFrom: string; weeks: number; asOf: string; lateReservePercent: number;
  travelMinutes: number; // Explicit fallback assumption for each inter-center move.
  seasonalPercent: number; // Extra long-horizon workload scenario, NOT learnt seasonality.
  absenceWorkerId?: string;
}
export interface StaffingAssignment {
  serviceId: string; workerId: string; centerId: string; date: string;
  startMinute: number; endMinute: number; personMinutes: number; support: boolean; estimated: boolean;
}
export interface StaffingDay {
  date: string; knownMinutes: number; estimatedMinutes: number; capacityMinutes: number;
  uncoveredMinutes: number; assignments: StaffingAssignment[]; reasons: string[];
  rests: { workerId: string; proposed: boolean }[];
}
export interface StaffingCenterWeek {
  centerId: string; week: string; knownMinutes: number; estimatedMinutes: number;
  uncoveredMinutes: number; supportMinutes: number;
  status: 'covered' | 'support' | 'shortage' | 'unknown' | 'empty';
}
export interface StaffingWeek {
  week: string; knownMinutes: number; estimatedMinutes: number; capacityMinutes: number;
  /** Collaborator share ALREADY INCLUDED in capacityMinutes, not contracted hours.
   * Weekly upper bound within visible dates, center windows, activity, absences/rest,
   * blocks, daily/weekly budgets and known six-day continuity. Includes assigned
   * cleaning; excludes budget consumed by external work/travel. Not coverage proof.
   */
  collaboratorCapacityMinutes?: number;
  contractedMinutes: number; uncoveredMinutes: number; criticalDays: number;
  idleMinutes: number;
  /** Employee weekly payroll; null if unknown or collaborator work needs unconfirmed pricing. */
  cost: number | null;
}
export interface StaffingResult {
  weeks: StaffingWeek[]; days: StaffingDay[]; centers: StaffingCenterWeek[];
  issues: StaffingIssue[];
}
