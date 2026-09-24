import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StaffingDataset, StaffingOptions, StaffingResult, StaffingWorker } from './types';
import { StaffingPanel } from './StaffingChrome';
import { StaffingScenario } from './StaffingScenario';
import { buildStaffingMonthlyView } from './monthly';
import { informationalIssues } from './presentation';
import { staffingBalance } from './balance';
import { availableMinutesForPeriod } from './StaffingTeam';
import {
  ForecastCandidates,
  ForecastSummary,
  ForecastWeek,
} from './StaffingRedesign';
import {
  applyForecastReserve,
  buildCandidateGroups,
  centerPriority,
  mergeCandidateGroups,
  weekEnd,
} from './StaffingRedesignUtils';
import type { ForecastDailyRow, ForecastPeriod, ForecastPoint, ForecastScreen, ForecastWeeklyRow } from './StaffingRedesignUtils';

type Compute = (dataset: StaffingDataset, options: StaffingOptions) => StaffingResult;
interface Props {
  dataset: StaffingDataset;
  dateFrom: string;
  asOf: string;
  weeks: number;
  compute: Compute;
  sedeName?: string;
  controls?: ReactNode;
  monthAnchor?: string;
  horizonMonths?: number;
  onDirtyChange?: (dirty: boolean) => void;
  onRetry?: () => void;
  demo?: boolean;
  userName?: string;
}

type Panel = 'scenario' | 'data' | null;

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function weekForDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

function unionMinutes(intervals: { startMinute: number; endMinute: number }[]): number {
  let end = 0;
  let total = 0;
  for (const interval of [...intervals].filter(item => item.endMinute > item.startMinute).sort((a, b) => a.startMinute - b.startMinute)) {
    total += Math.max(0, interval.endMinute - Math.max(end, interval.startMinute));
    end = Math.max(end, interval.endMinute);
  }
  return total;
}

function paidMinutes(worker: StaffingWorker, date: string): number {
  return unionMinutes((worker.blockedSlots || []).filter(block => block.consumesContract && (!block.date ? block.day === new Date(`${date}T12:00:00Z`).getUTCDay() : block.date === date)));
}

function taskAssignments(result: StaffingResult, serviceId: string) {
  return result.days.flatMap(day => day.assignments).filter(assignment => assignment.serviceId === serviceId);
}

function assignedForWorker(result: StaffingResult, workerId: string, from: string, to: string): number {
  return result.days.filter(day => inRange(day.date, from, to)).flatMap(day => day.assignments).filter(assignment => assignment.workerId === workerId).reduce((total, assignment) => total + assignment.personMinutes, 0);
}

function contractMinimumForMonth(worker: StaffingWorker, month: string): number {
  const monthStart = `${month}-01`;
  const start = new Date(`${monthStart}T12:00:00Z`);
  const monthEnd = new Date(start.getTime());
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const end = monthEnd.toISOString().slice(0, 10);
  const activeFrom = worker.activeFrom && worker.activeFrom > monthStart ? worker.activeFrom : monthStart;
  const activeTo = worker.activeTo && worker.activeTo < end ? worker.activeTo : end;
  if (activeFrom > activeTo) return 0;
  const activeDays = Math.floor((new Date(`${activeTo}T12:00:00Z`).getTime() - new Date(`${activeFrom}T12:00:00Z`).getTime()) / 86400000) + 1;
  const expectedWorkDays = Math.max(1, 7 - (worker.restDay == null ? 0 : 1));
  const absentDays = worker.unavailableDates.filter(date => inRange(date, activeFrom, activeTo)).length;
  return Math.max(0, worker.weeklyMinutes * activeDays / 7 - absentDays * (worker.weeklyMinutes / expectedWorkDays));
}

function availabilityForService(worker: StaffingWorker, service: StaffingDataset['services'][number], result: StaffingResult, travelMinutes: number): { start: number; end: number } | null {
  const dayOfWeek = new Date(`${service.date}T12:00:00Z`).getUTCDay();
  if (worker.activeFrom && service.date < worker.activeFrom) return null;
  if (worker.activeTo && service.date > worker.activeTo) return null;
  if (worker.excludedCenterIds?.includes(service.centerId)) return null;
  if (!worker.canMove && !worker.homeCenterIds.includes(service.centerId)) return null;
  if (worker.unavailableDates.includes(service.date) || worker.confirmedRestDates.includes(service.date) || (!worker.flexibleRest && worker.restDay === dayOfWeek)) return null;
  const requiredMinutes = service.personMinutes / Math.max(1, service.requiredWorkers);
  const dayResult = result.days.find(day => day.date === service.date);
  const existing = dayResult?.assignments.filter(assignment => assignment.workerId === worker.id && assignment.serviceId !== service.id) || [];
  const blocks = (worker.blockedSlots || []).filter(block => block.date === service.date || (!block.date && block.day === dayOfWeek));
  const slots = worker.availability.filter(slot => slot.day === dayOfWeek);
  const paidToday = paidMinutes(worker, service.date);
  const workToday = existing.reduce((total, assignment) => total + assignment.personMinutes, 0) + paidToday;
  if (worker.maxDailyMinutes !== undefined && workToday + requiredMinutes > worker.maxDailyMinutes) return null;
  let consecutiveDays = 1;
  for (const direction of [-1, 1]) {
    for (let offset = 1; offset <= 6; offset += 1) {
      const date = addDays(service.date, direction * offset);
      const adjacent = result.days.find(day => day.date === date);
      const worked = adjacent?.assignments.some(assignment => assignment.workerId === worker.id) || paidMinutes(worker, date) > 0;
      if (!worked) break;
      consecutiveDays += 1;
    }
  }
  if (consecutiveDays > 6) return null;
  for (const slot of slots) {
    const start = Math.max(slot.startMinute, service.startMinute);
    const end = Math.min(slot.endMinute, service.endMinute);
    if (end - start < requiredMinutes) continue;
    if (blocks.some(block => block.startMinute < end && block.endMinute > start)) continue;
    if (existing.some(assignment => assignment.startMinute < end && assignment.endMinute > start)) continue;
    const previous = existing.filter(assignment => assignment.endMinute <= start).sort((a, b) => b.endMinute - a.endMinute)[0];
    const next = existing.filter(assignment => assignment.startMinute >= end).sort((a, b) => a.startMinute - b.startMinute)[0];
    if (previous && previous.centerId !== service.centerId && previous.endMinute + travelMinutes > start) continue;
    if (next && next.centerId !== service.centerId && end + travelMinutes > next.startMinute) continue;
    return { start, end };
  }
  return null;
}

export function StaffingDashboard({ dataset, dateFrom, asOf, weeks, compute, sedeName, controls, monthAnchor = dateFrom, horizonMonths = 3, onDirtyChange, onRetry, demo = false, userName }: Props) {
  const [screen, setScreen] = useState<ForecastScreen>('summary');
  const [period, setPeriod] = useState<ForecastPeriod>('monthly');
  const [selectedWeek, setSelectedWeek] = useState(dateFrom);
  const [centerFilter, setCenterFilter] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [weekForecast, setWeekForecast] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [absenceWorkerId, setAbsenceWorkerId] = useState('');
  const [overrides, setOverrides] = useState<Record<string, Partial<StaffingWorker>>>({});
  const [reinforcements, setReinforcements] = useState<StaffingWorker[]>([]);
  const [seasonalPercent, setSeasonalPercent] = useState(0);
  const [travelMinutes, setTravelMinutes] = useState(15);
  const initialMonth = monthAnchor.slice(0, 7);

  const baseOptions = useMemo<StaffingOptions>(() => ({ dateFrom, asOf, weeks, lateReservePercent: 0, seasonalPercent: 0, travelMinutes: 15 }), [dateFrom, asOf, weeks]);
  const options = useMemo<StaffingOptions>(() => ({ ...baseOptions, seasonalPercent, travelMinutes, absenceWorkerId: absenceWorkerId || undefined }), [baseOptions, seasonalPercent, travelMinutes, absenceWorkerId]);
  const changes = Object.keys(overrides).length > 0 || reinforcements.length > 0 || !!absenceWorkerId || seasonalPercent !== 0 || travelMinutes !== 15;
  const simulationData = useMemo(() => ({ ...dataset, workers: [...dataset.workers, ...reinforcements].map(worker => ({ ...worker, ...overrides[worker.id] })) }), [dataset, overrides, reinforcements]);
  const baseline = useMemo(() => compute(dataset, baseOptions), [compute, dataset, baseOptions]);
  const result = useMemo(() => changes ? compute(simulationData, options) : baseline, [compute, simulationData, options, changes, baseline]);
  const monthlyView = useMemo(() => buildStaffingMonthlyView(result, monthAnchor, horizonMonths, asOf), [result, monthAnchor, horizonMonths, asOf]);
  const availableWeeks = useMemo(() => result.weeks.map(week => week.week), [result.weeks]);
  const selectedWeekData = result.weeks.find(week => week.week === selectedWeek) || result.weeks[0];
  const selectedWeekKey = selectedWeekData?.week || selectedWeek;
  const selectedWeekDays = useMemo(() => result.days.filter(day => day.date >= selectedWeekKey && day.date <= weekEnd(selectedWeekKey)), [result.days, selectedWeekKey]);
  const allIssues = useMemo(() => [...dataset.issues, ...result.issues, ...monthlyView.issues].filter((issue, index, all) => all.findIndex(other => other.code === issue.code && other.message === issue.message && other.centerId === issue.centerId) === index), [dataset.issues, result.issues, monthlyView.issues]);
  const failures = allIssues.filter(issue => ['source-unavailable', 'client-state-unavailable', 'extension-unavailable'].includes(issue.code));
  const uncertain = !dataset.services.length || !dataset.workers.length || allIssues.some(issue => !informationalIssues.has(issue.code));

  useEffect(() => { onDirtyChange?.(changes); return () => onDirtyChange?.(false); }, [changes, onDirtyChange]);
  useEffect(() => { if (!changes) return; const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [changes]);

  const selectWeek = (week: string) => { if (availableWeeks.includes(week)) setSelectedWeek(week); };
  const changeWorker = (id: string, change: Partial<StaffingWorker>) => setOverrides(current => {
    const currentWorker = simulationData.workers.find(worker => worker.id === id);
    const nextWeeklyMinutes = change.weeklyMinutes ?? currentWorker?.weeklyMinutes;
    return { ...current, [id]: { ...current[id], ...change, ...(nextWeeklyMinutes !== undefined ? { weeklyMinutesMax: Math.round(nextWeeklyMinutes * 1.3) } : {}) } };
  });
  const reset = () => { if (changes && !window.confirm('¿Descartar todos los cambios del escenario? No se han guardado.')) return; setOverrides({}); setAbsenceWorkerId(''); setReinforcements([]); setSeasonalPercent(0); setTravelMinutes(15); };
  const addReinforcement = () => {
    const center = dataset.centers.find(item => item.id === centerFilter) || dataset.centers[0];
    if (!center) return;
    setReinforcements(current => [...current, { id: `hypothetical:${current.length + 1}`, name: `Refuerzo hipotético ${current.length + 1}`, weeklyMinutes: 900, weeklyMinutesMax: 1170, homeCenterIds: [center.id], availability: Array.from({ length: 7 }, (_, day) => ({ day, startMinute: center.startMinute, endMinute: center.endMinute })), restDay: 0, flexibleRest: false, canMove: true, unavailableDates: [], confirmedRestDates: [], activeFrom: dateFrom }]);
  };
  const openCandidates = (serviceId?: string) => {
    const candidate = serviceId && candidateServices.some(service => service.id === serviceId)
      ? serviceId
      : candidateServices.find(service => !taskAssignments(result, service.id).length)?.id || candidateServices[0]?.id || '';
    setSelectedServiceId(candidate);
    setScreen('candidates');
  };
  const openCalendar = () => {
    const query = selectedService ? `?date=${encodeURIComponent(selectedService.date)}&task=${encodeURIComponent(selectedService.id)}` : '';
    if (typeof window !== 'undefined') window.location.assign(`/calendar${query}`);
  };
  const changePeriod = (value: ForecastPeriod) => { setPeriod(value); if (value === 'weekly' && !selectedWeekData && availableWeeks[0]) setSelectedWeek(availableWeeks[0]); };

  const dailyRows = useMemo<ForecastDailyRow[]>(() => result.days.map(day => {
    const services = dataset.services.filter(service => service.date === day.date && (!centerFilter || service.centerId === centerFilter) && Number.isFinite(service.personMinutes) && service.personMinutes > 0);
    const tourismMinutes = services.filter(service => service.kind !== 'fixed').reduce((total, service) => total + service.personMinutes, 0);
    const fixedMinutes = services.filter(service => service.kind === 'fixed').reduce((total, service) => total + service.personMinutes, 0);
    const otherMinutes = fixedMinutes + simulationData.workers.reduce((total, worker) => total + paidMinutes(worker, day.date), 0);
    const allAssignments = [...day.assignments].sort((a, b) => a.startMinute - b.startMinute || a.workerId.localeCompare(b.workerId));
    const travel = allAssignments.reduce((total, assignment, index, assignments) => {
      const previous = assignments.slice(0, index).filter(item => item.workerId === assignment.workerId).at(-1);
      const transitionIsInScope = !centerFilter || assignment.centerId === centerFilter || previous?.centerId === centerFilter;
      return total + (transitionIsInScope && previous && previous.centerId !== assignment.centerId ? travelMinutes : 0);
    }, 0);
    const estimatedMinutes = centerFilter
      ? services.filter(service => service.kind !== 'fixed').reduce((total, service) => total + service.personMinutes * seasonalPercent / 100, 0)
      : day.estimatedMinutes;
    const workloadMinutes = tourismMinutes + otherMinutes + travel;
    const forecastMinutes = applyForecastReserve(tourismMinutes) + otherMinutes + travel + estimatedMinutes;
    const capacityMinutes = day.capacityMinutes;
    return { date: day.date, taskCount: services.length, tourismMinutes, otherMinutes, travelMinutes: travel, estimatedMinutes, workloadMinutes, forecastMinutes, capacityMinutes, balanceMinutes: capacityMinutes - forecastMinutes, deficitMinutes: Math.max(0, forecastMinutes - capacityMinutes) };
  }), [result.days, simulationData.workers, travelMinutes, centerFilter, dataset.services, seasonalPercent]);
  const summaryDays = period === 'weekly' ? selectedWeekDays.map(day => dailyRows.find(row => row.date === day.date)).filter((row): row is ForecastDailyRow => !!row) : dailyRows;
  const summaryPoints = useMemo<ForecastPoint[]>(() => {
    if (period === 'weekly') return summaryDays.map(row => ({ key: row.date, label: row.date.slice(8), secondaryLabel: `Día ${new Date(`${row.date}T12:00:00Z`).getUTCDay()}`, workloadMinutes: row.workloadMinutes, forecastMinutes: row.forecastMinutes, capacityMinutes: row.capacityMinutes, deficitMinutes: row.deficitMinutes }));
    return result.weeks.map(week => {
      const days = dailyRows.filter(day => day.date >= week.week && day.date <= weekEnd(week.week));
      const workloadMinutes = days.reduce((total, day) => total + day.workloadMinutes, 0);
      const forecastMinutes = days.reduce((total, day) => total + day.forecastMinutes, 0);
      const capacityMinutes = days.reduce((total, day) => total + day.capacityMinutes, 0);
      return { key: week.week, label: formatWeekShort(week.week), secondaryLabel: `Sem. ${weekNumber(week.week)}`, workloadMinutes, forecastMinutes, capacityMinutes, deficitMinutes: Math.max(0, forecastMinutes - capacityMinutes) };
    });
  }, [period, summaryDays, result.weeks, dailyRows]);
  const weeklyRows = useMemo<ForecastWeeklyRow[]>(() => {
    const source = period === 'weekly' && selectedWeekData ? [selectedWeekData] : result.weeks;
    return source.map(week => {
      const days = dailyRows.filter(day => day.date >= week.week && day.date <= weekEnd(week.week));
      const knownMinutes = days.reduce((total, day) => total + day.workloadMinutes, 0);
      const forecastMinutes = days.reduce((total, day) => total + day.forecastMinutes, 0);
      const capacityMinutes = days.reduce((total, day) => total + day.capacityMinutes, 0);
      const balanceMinutes = capacityMinutes - forecastMinutes;
      return { week: week.week, label: `Sem. ${weekNumber(week.week)}`, dates: `${formatWeekShort(week.week)} – ${formatWeekShort(weekEnd(week.week))}`, knownMinutes, forecastMinutes, capacityMinutes, balanceMinutes, status: balanceMinutes < 0 ? 'deficit' : 'covered' };
    });
  }, [period, selectedWeekData, result.weeks, dailyRows]);
  const hoursExpected = summaryPoints.reduce((total, point) => total + point.forecastMinutes, 0);
  const capacity = summaryPoints.reduce((total, point) => total + point.capacityMinutes, 0);
  const peak = summaryDays.reduce<ForecastDailyRow | undefined>((best, row) => !best || row.forecastMinutes - row.capacityMinutes > best.forecastMinutes - best.capacityMinutes ? row : best, undefined);
  const summaryFrom = period === 'weekly' && selectedWeekData ? selectedWeekData.week : dateFrom;
  const summaryTo = period === 'weekly' && selectedWeekData ? weekEnd(selectedWeekData.week) : addDays(dateFrom, weeks * 7 - 1);
  const periodServices = dataset.services.filter(service => inRange(service.date, summaryFrom, summaryTo) && (!centerFilter || service.centerId === centerFilter) && Number.isFinite(service.personMinutes) && service.personMinutes > 0);
  const candidateFrom = screen === 'week' || screen === 'candidates' ? selectedWeekKey : summaryFrom;
  const candidateTo = screen === 'week' || screen === 'candidates' ? weekEnd(selectedWeekKey) : summaryTo;
  const candidateServices = dataset.services.filter(service => inRange(service.date, candidateFrom, candidateTo) && (!centerFilter || service.centerId === centerFilter) && Number.isFinite(service.personMinutes) && service.personMinutes > 0);
  useEffect(() => {
    if (selectedServiceId && !candidateServices.some(service => service.id === selectedServiceId)) setSelectedServiceId('');
  }, [candidateServices, selectedServiceId]);
  const unassignedCount = periodServices.filter(service => !taskAssignments(result, service.id).length).length;
  const selectedService = candidateServices.find(service => service.id === selectedServiceId) || candidateServices.find(service => !taskAssignments(result, service.id).length) || candidateServices[0];
  const selectedCenterName = selectedService ? dataset.centers.find(center => center.id === selectedService.centerId)?.name || 'Centro sin nombre' : 'Centro sin nombre';
  const assignedCount = selectedService ? taskAssignments(result, selectedService.id).length : 0;
  const atRiskWorkers = useMemo(() => {
    const month = selectedService?.date?.slice(0, 7) || initialMonth;
    return simulationData.workers.filter(worker => {
      const minimum = contractMinimumForMonth(worker, month);
      const monthStart = `${month}-01`;
      const monthEndDate = new Date(`${monthStart}T12:00:00Z`);
      monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1, 0);
      const monthEnd = monthEndDate.toISOString().slice(0, 10);
      const worked = assignedForWorker(result, worker.id, monthStart, monthEnd) + result.days.filter(day => inRange(day.date, monthStart, monthEnd)).reduce((total, day) => total + paidMinutes(worker, day.date), 0);
      return worked + 0.01 < minimum;
    });
  }, [simulationData.workers, result, selectedService?.date, initialMonth]);
  const candidateGroups = useMemo(() => {
    if (!selectedService) return [];
    const service = selectedService;
    const month = service.date.slice(0, 7);
    const week = weekForDate(service.date);
    const monthStart = `${month}-01`;
    const monthEndDate = new Date(`${monthStart}T12:00:00Z`);
    monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1, 0);
    const monthEnd = monthEndDate.toISOString().slice(0, 10);
    const candidates = simulationData.workers.map(worker => {
      const availability = availabilityForService(worker, service, result, travelMinutes);
      if (!availability) return null;
      const weeklyWorked = assignedForWorker(result, worker.id, week, weekEnd(week)) + result.days.filter(day => inRange(day.date, week, weekEnd(week))).reduce((total, day) => total + paidMinutes(worker, day.date), 0);
      const requiredMinutes = service.personMinutes / Math.max(1, service.requiredWorkers);
      if (weeklyWorked + requiredMinutes > (worker.weeklyMinutesMax ?? worker.weeklyMinutes)) return null;
      const minimum = contractMinimumForMonth(worker, month);
      const worked = assignedForWorker(result, worker.id, monthStart, monthEnd) + result.days.filter(day => inRange(day.date, monthStart, monthEnd)).reduce((total, day) => total + paidMinutes(worker, day.date), 0);
      return { worker, group: centerPriority(worker, service.centerId), pendingMinutes: Math.max(0, minimum - worked), availabilityStart: availability.start, availabilityEnd: availability.end };
    }).filter((candidate): candidate is NonNullable<typeof candidate> => !!candidate);
    return mergeCandidateGroups(buildCandidateGroups(candidates));
  }, [selectedService, simulationData.workers, result, travelMinutes]);
  const teamBalance = useMemo(() => staffingBalance(simulationData.workers, summaryDays.map(row => result.days.find(day => day.date === row.date)!).filter(Boolean), hoursExpected, 0), [simulationData.workers, summaryDays, result.days, hoursExpected]);
  const editedIds = useMemo(() => new Set([...Object.keys(overrides), ...reinforcements.map(worker => worker.id)]), [overrides, reinforcements]);
  const restoreWorker = (id: string) => setOverrides(current => { const next = { ...current }; delete next[id]; return next; });
  const applySuggestion = () => { for (const row of teamBalance.rows) if (row.headroomMinutes > 0) changeWorker(row.worker.id, { weeklyMinutes: row.worker.weeklyMinutes + Math.round(row.headroomMinutes / Math.max(1, teamBalance.factor) / 15) * 15 }); };
  const scenario = <StaffingScenario workers={simulationData.workers} absence={absenceWorkerId} onAbsence={setAbsenceWorkerId} onChange={changeWorker} onAdd={addReinforcement} onReset={reset} canAdd={!!dataset.centers.length && reinforcements.length < 20}><div className="rounded-lg border border-[#dbe5ef] bg-white p-3 text-xs text-[#617594]">{Object.keys(overrides).length} personas editadas · {reinforcements.length} refuerzos · {absenceWorkerId ? '1 ausencia simulada' : 'sin ausencia adicional'} · {editedIds.size} cambios en memoria</div></StaffingScenario>;

  if (screen === 'candidates') return <ForecastCandidates dataset={simulationData} service={selectedService} centerName={selectedCenterName} assignments={assignedCount} groups={candidateGroups} onBack={() => setScreen('week')} onCalendar={openCalendar} />;
  if (screen === 'week') return <ForecastWeek sedeName={sedeName} week={selectedWeekKey} rows={selectedWeekDays.map(day => dailyRows.find(row => row.date === day.date)).filter((row): row is ForecastDailyRow => !!row)} assignedCount={selectedWeekDays.reduce((total, day) => total + day.assignments.filter(assignment => !centerFilter || assignment.centerId === centerFilter).length, 0)} unassignedCount={selectedWeekDays.reduce((total, day) => total + dataset.services.filter(service => service.date === day.date && (!centerFilter || service.centerId === centerFilter) && !taskAssignments(result, service.id).length).length, 0)} pendingWorkers={atRiskWorkers.length} showForecast={weekForecast} onShowForecast={setWeekForecast} onBack={() => setScreen('summary')} onCandidates={() => openCandidates()} onOpenTeam={() => setPanel('scenario')} uncertain={uncertain} />;

  return <>
    {failures.length > 0 && <div role="alert" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f5cfd1] bg-[#fff3f4] p-3 text-sm text-[#8e1e24] sm:mx-6 lg:mx-7"><span>No se pudieron leer todas las fuentes: la previsión está incompleta y no se interpreta como ausencia de actividad.</span>{onRetry && <button type="button" className="font-semibold underline" onClick={onRetry}>Reintentar</button>}<button type="button" className="font-semibold underline" onClick={() => setPanel('data')}>Ver datos parciales</button></div>}
    <ForecastSummary sedeName={sedeName} userName={userName} dateFrom={dateFrom} dateTo={dateToFor(dateFrom, weeks)} period={period} onPeriod={changePeriod} centerOptions={dataset.centers} centerId={centerFilter} onCenter={setCenterFilter} controls={controls} points={summaryPoints} weeklyRows={weeklyRows} hoursExpected={hoursExpected} capacity={capacity} maxDeficit={peak?.deficitMinutes || 0} maxDeficitDate={peak?.date} atRiskCount={atRiskWorkers.length} workerCount={simulationData.workers.length} unassignedCount={unassignedCount} onReviewTeam={() => setPanel('scenario')} onOpenWeek={week => { selectWeek(week); setScreen('week'); }} onOpenCandidates={() => openCandidates()} uncertain={uncertain} />
    {panel === 'scenario' && <StaffingPanel title="Simular cambios" onClose={() => setPanel(null)}><p className="text-sm text-[#617594]">Solo en memoria. Las horas, libranzas y ausencias afectan a la simulación, no al calendario ni a las fichas reales.</p>{scenario}<details className="rounded-lg border border-[#dbe5ef] bg-white p-3"><summary className="cursor-pointer font-semibold">Ajustes avanzados</summary><div className="mt-3 grid gap-3"><label className="grid gap-1 text-sm">Incremento lejano de demanda (%)<input className="min-h-10 rounded-lg border border-[#dbe5ef] px-3" type="number" min="0" max="200" value={seasonalPercent} onChange={event => setSeasonalPercent(Math.max(0, Math.min(200, Number(event.target.value))))} /></label><label className="grid gap-1 text-sm">Traslado entre edificios (minutos)<input className="min-h-10 rounded-lg border border-[#dbe5ef] px-3" type="number" min="0" max="120" step="15" value={travelMinutes} onChange={event => setTravelMinutes(Math.max(0, Math.min(120, Number(event.target.value))))} /></label></div></details></StaffingPanel>}
    {panel === 'data' && <StaffingPanel title="Datos y criterios" onClose={() => setPanel(null)}><p className="text-sm">Las cifras distinguen tareas conocidas, la previsión adicional del 20 %, capacidad diaria y horas trabajadas. Una tarea sin asignar sigue siendo carga pendiente, pero no cuenta para las horas de ninguna persona.</p><p className="text-xs text-[#617594]">Lectura {dataset.fetchedAt || 'sin fecha'} · {allIssues.length} incidencias y criterios.</p><h3 className="font-semibold">Fuentes y límites</h3>{dataset.providerCoverage?.map(provider => <article key={provider.provider} className="border-b border-[#eef3f8] py-3 text-sm"><strong>{provider.label}</strong><p>{provider.status === 'unknown' ? 'Fuente no verificable' : provider.status === 'none' ? 'Sin reservas activas observadas' : `${provider.reservations30} reservas en 30 días · ${provider.reservations31to60} entre días 31–60`}</p></article>)}{allIssues.slice(0, 30).map((issue, index) => <p key={`${issue.code}-${index}`} className="border-b border-[#eef3f8] py-2 text-xs text-[#617594]">{issue.message}</p>)}</StaffingPanel>}
  </>;
}

function dateToFor(dateFrom: string, weeks: number): string { return addDays(dateFrom, weeks * 7 - 1); }
function weekNumber(week: string): number { const date = new Date(`${week}T12:00:00Z`); const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); return Math.ceil((((date.getTime() - first.getTime()) / 86400000) + first.getUTCDay() + 1) / 7); }
function formatWeekShort(date: string): string { return `${date.slice(8, 10)}/${date.slice(5, 7)}`; }
