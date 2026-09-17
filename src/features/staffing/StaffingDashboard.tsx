import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StaffingDataset, StaffingOptions, StaffingResult, StaffingWorker } from './types';
import { StaffingEvolution, StaffingHeader, StaffingPanel } from './StaffingChrome';
import { StaffingScenario } from './StaffingScenario';
import { StaffingDetails } from './StaffingDetails';
import { StaffingAttention } from './StaffingAttention';
import { StaffingBalance } from './StaffingBalance';
import { staffingBalance, suggestedWeeklyMinutes } from './balance';
import { StaffingTeam, availableMinutesForPeriod } from './StaffingTeam';

import { StaffingWeekOptions } from './StaffingWeekOptions';
import { StaffingComparison } from './StaffingComparison';
import { buildStaffingMonthlyView } from './monthly';
import { fieldClass, fullDate, hours, informationalIssues, knownUncovered, money, panelClass, shortDate, weekdays } from './presentation';

type Compute = (dataset: StaffingDataset, options: StaffingOptions) => StaffingResult;
type PeriodMode = 'month' | 'week' | 'period';
interface Props { dataset: StaffingDataset; dateFrom: string; asOf: string; weeks: number; compute: Compute; sedeName?: string; controls?: ReactNode; monthAnchor?: string; horizonMonths?: number; onDirtyChange?: (dirty: boolean) => void; onRetry?: () => void; demo?: boolean }

export function StaffingDashboard({ dataset, dateFrom, asOf, weeks, compute, sedeName, controls, monthAnchor = dateFrom, horizonMonths = 3, onDirtyChange, onRetry, demo = false }: Props) {
  const [lateReservePercent, setLateReservePercent] = useState(20);
  const [cushionPercent, setCushionPercent] = useState(20);
  const [seasonalPercent, setSeasonalPercent] = useState(0);
  const [travelMinutes, setTravelMinutes] = useState(20);
  const [absenceWorkerId, setAbsenceWorkerId] = useState('');
  const [overrides, setOverrides] = useState<Record<string, Partial<StaffingWorker>>>({});
  const [reinforcements, setReinforcements] = useState<StaffingWorker[]>([]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('week');
  const initialWeek = (() => { const monthStart = `${monthAnchor.slice(0, 7)}-01`; if (dateFrom >= monthStart) return dateFrom; const start = new Date(`${monthStart}T12:00:00Z`); start.setUTCDate(1 + ((8 - start.getUTCDay()) % 7)); const candidate = start.toISOString().slice(0, 10); return candidate >= dateFrom ? candidate : dateFrom; })();
  const [selectedWeek, setSelectedWeek] = useState(initialWeek);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [centerFilter, setCenterFilter] = useState('');
  const [activeView, setActiveView] = useState<'forecast' | 'team' | 'scenarios'>('forecast');
  const [panel, setPanel] = useState<'scenario' | 'data' | null>(null);
  const baseOptions = useMemo(() => ({ dateFrom, asOf, weeks, lateReservePercent: 20, seasonalPercent: 0, travelMinutes: 20 }), [dateFrom, asOf, weeks]);
  const options = useMemo(() => ({ ...baseOptions, lateReservePercent, seasonalPercent, travelMinutes, absenceWorkerId: absenceWorkerId || undefined }), [baseOptions, lateReservePercent, seasonalPercent, travelMinutes, absenceWorkerId]);
  const changes = Object.keys(overrides).length > 0 || !!absenceWorkerId || reinforcements.length > 0 || lateReservePercent !== 20 || cushionPercent !== 20 || seasonalPercent !== 0 || travelMinutes !== 20;
  const simulationData = useMemo(() => ({ ...dataset, workers: [...dataset.workers, ...reinforcements].map(worker => ({ ...worker, ...overrides[worker.id] })) }), [dataset, overrides, reinforcements]);
  const baseline = useMemo(() => compute(dataset, baseOptions), [compute, dataset, baseOptions]);
  const result = useMemo(() => changes ? compute(simulationData, options) : baseline, [compute, simulationData, options, changes, baseline]);
  const monthlyView = useMemo(() => buildStaffingMonthlyView(result, monthAnchor, horizonMonths, asOf), [result, monthAnchor, horizonMonths, asOf]);
  const periodSummary = useMemo(() => {
    const knownMinutes = result.weeks.reduce((n, w) => n + w.knownMinutes, 0);
    const estimatedMinutes = result.weeks.reduce((n, w) => n + w.estimatedMinutes, 0);
    const capacityMinutes = result.weeks.reduce((n, w) => n + w.capacityMinutes, 0);
    return { knownMinutes, estimatedMinutes, capacityMinutes };
  }, [result.weeks]);
  const incompleteWeeks = useMemo(() => new Set(monthlyView.months.filter(month => month.status === 'future' && month.estimatedMinutes === 0).flatMap(month => month.weeks.map(week => week.week))), [monthlyView]);
  const selected = result.weeks.find(week => week.week === selectedWeek);
  const selectedMonthData = monthlyView.months.find(item => item.month === (selectedMonth || monthlyView.months[0]?.month));
  const availableWeeks = result.weeks.map(week => week.week);
  const baselineWeek = baseline.weeks.find(week => week.week === selected?.week);
  const issues = [...dataset.issues, ...result.issues, ...monthlyView.issues].filter((issue, index, all) => all.findIndex(other => other.code === issue.code && other.message === issue.message && other.centerId === issue.centerId) === index);
  const selectedDays = result.days.filter(day => selected && day.date >= selected.week && day.date < new Date(Date.parse(`${selected.week}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10));
  const summaryPeriod = periodMode === 'period' ? periodSummary : periodMode === 'month' ? selectedMonthData : selected;
  const uncertain = !dataset.services.length || !dataset.workers.length || !summaryPeriod || issues.some(issue => !informationalIssues.has(issue.code)) || (selected && result.centers.some(cell => cell.week === selected.week && cell.status === 'unknown'));
  const failures = issues.filter(issue => ['source-unavailable', 'client-state-unavailable', 'extension-unavailable'].includes(issue.code));
  const dateTo = new Date(Date.parse(`${dateFrom}T12:00:00Z`) + (weeks * 7 - 1) * 86400000).toISOString().slice(0, 10);
  // El resumen ejecutivo sigue al periodo elegido: mes/mes, semana/semana o el horizonte completo.
  const monthWeekKeys = useMemo(() => new Set((selectedMonthData?.weeks ?? []).map(segment => segment.week)), [selectedMonthData]);
    const attentionWeeks = useMemo(() => periodMode === 'month'
      ? result.weeks.filter(week => monthWeekKeys.has(week.week))
      : periodMode === 'week' && selected
        ? result.weeks.filter(week => week.week === selected.week)
        : result.weeks, [periodMode, result.weeks, monthWeekKeys, selected]);
    const attentionMonths = periodMode === 'month' ? (selectedMonthData ? [selectedMonthData] : []) : monthlyView.months;
    const weekEnd = selected ? new Date(Date.parse(`${selected.week}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10) : '';
      // El selector de fechas es el maestro: días, equipo y resumen comparten el mismo periodo.
      const periodDays = useMemo(() => {
        if (periodMode === 'period') return result.days;
        if (periodMode === 'month' && selectedMonthData) return result.days.filter(day => day.date >= selectedMonthData.includedFrom && day.date <= selectedMonthData.includedTo);
        return selectedDays;
      }, [periodMode, selectedMonthData, result.days, selectedDays]);
      // Los totales del periodo se suman por días civiles: nunca por semanas completas que se salen del mes.
      const periodTotals = useMemo(() => periodDays.reduce((acc, day) => ({
        knownMinutes: acc.knownMinutes + day.knownMinutes,
        estimatedMinutes: acc.estimatedMinutes + day.estimatedMinutes,
        capacityMinutes: acc.capacityMinutes + day.capacityMinutes,
      }), { knownMinutes: 0, estimatedMinutes: 0, capacityMinutes: 0 }), [periodDays]);
      // Jornada comprometida: lo que se paga y hay que cubrir, con el mismo criterio que la tabla de Equipo.
      const teamCommittedMinutes = useMemo(() => {
        const factor = periodDays.length / 7;
        return simulationData.workers.reduce((total, worker) => total + availableMinutesForPeriod(worker, periodDays, worker.weeklyMinutes * factor), 0);
      }, [simulationData.workers, periodDays]);
      const periodPeak = periodMode === 'month' && selectedMonthData
        ? [...selectedMonthData.weeks].sort((a, b) => (b.knownMinutes + b.estimatedMinutes) - (a.knownMinutes + a.estimatedMinutes) || a.week.localeCompare(b.week))[0]
        : undefined;
      const overloadedPeriod = periodMode === 'month' && selectedMonthData
        ? selectedMonthData.weeks.filter(segment => segment.knownMinutes > segment.capacityMinutes).map(segment => ({ week: segment.week, knownMinutes: segment.knownMinutes, capacityMinutes: segment.capacityMinutes }))
        : undefined;
      const periodWork = periodTotals.knownMinutes + periodTotals.estimatedMinutes;
      const periodGap = periodWork - teamCommittedMinutes;
      const periodOverCeiling = periodWork - periodTotals.capacityMinutes;
      // Cuadre de plantilla: carga prevista → objetivo con colchón → horas comprometidas del escenario.
      const balance = useMemo(() => staffingBalance(simulationData.workers, periodDays, periodWork, cushionPercent), [simulationData.workers, periodDays, periodWork, cushionPercent]);
      const editedIds = useMemo(() => new Set([...Object.keys(overrides), ...reinforcements.map(item => item.id)]), [overrides, reinforcements]);
      const attentionScope = periodMode === 'month'
        ? { label: `Total de ${selectedMonthData?.label || 'mes seleccionado'}`, subtitle: selectedMonthData ? `${shortDate(selectedMonthData.includedFrom)} – ${shortDate(selectedMonthData.includedTo)} · ${periodDays.length} días` : `${periodDays.length} días` }
        : periodMode === 'week' && selected
          ? { label: `Semana del ${shortDate(selected.week)}`, subtitle: `${shortDate(selected.week)} – ${shortDate(weekEnd)}` }
          : { label: 'Total del periodo', subtitle: `${attentionWeeks.length} semanas · ${monthlyView.months.length} meses` };
      const teamPeriodLabel = periodMode === 'month' ? (selectedMonthData ? `${selectedMonthData.label} · total del mes` : undefined) : periodMode === 'period' ? 'Periodo completo · total del horizonte' : undefined;
    useEffect(() => { onDirtyChange?.(changes); return () => onDirtyChange?.(false); }, [changes, onDirtyChange]);
  useEffect(() => { if (!changes) return; const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [changes]);
  const changeWorker = (id: string, change: Partial<StaffingWorker>) => setOverrides(current => ({ ...current, [id]: { ...current[id], ...change } }));
  const reset = () => { if (changes && !window.confirm('¿Descartar todos los cambios del escenario? No se han guardado.')) return; setOverrides({}); setAbsenceWorkerId(''); setReinforcements([]); setLateReservePercent(20); setCushionPercent(20); setSeasonalPercent(0); setTravelMinutes(20); };
  const restoreWorker = (id: string) => setOverrides(current => { const next = { ...current }; delete next[id]; return next; });
  const applySuggestion = () => { const plan = suggestedWeeklyMinutes(balance); for (const [id, weeklyMinutes] of Object.entries(plan)) changeWorker(id, { weeklyMinutes }); };
  const addReinforcement = () => {
    const center = dataset.centers.find(item => item.id === centerFilter) || dataset.centers[0];
    if (!center) return;
    setReinforcements(current => [...current, { id: `hypothetical:${current.length + 1}`, name: `Refuerzo hipotético ${current.length + 1}`, weeklyMinutes: 900, homeCenterIds: [center.id], availability: weekdays.map((_, day) => ({ day, startMinute: center.startMinute, endMinute: center.endMinute })), restDay: 0, flexibleRest: false, canMove: true, unavailableDates: [], confirmedRestDates: [], activeFrom: dateFrom }]);
  };
  const selectMonth = (month: string) => {
    const selected = monthlyView.months.find(item => item.month === month);
    const next = selected?.weeks.find(week => week.week >= selected.startDate && availableWeeks.includes(week.week)) || selected?.weeks.find(week => availableWeeks.includes(week.week));
    setSelectedMonth(month);
    setSelectedWeek(periodMode === 'month' ? '' : next?.week || '');
  };
  const changePeriodMode = (mode: PeriodMode) => {
      setPeriodMode(mode);
      if (mode === 'month') {
        setSelectedWeek('');
        return;
      }
      if (mode === 'period') {
        setSelectedWeek('');
        setSelectedMonth('');
        return;
      }
      const month = monthlyView.months.find(item => item.month === selectedMonth) || monthlyView.months[0];
      const next = month?.weeks.find(week => week.week >= month.startDate && availableWeeks.includes(week.week)) || month?.weeks.find(week => availableWeeks.includes(week.week));
      setSelectedWeek(next?.week || (selectedMonth ? '' : availableWeeks[0] || ''));
    };
  const selectWeek = (week: string) => {
    setSelectedWeek(week);
    const month = monthlyView.months.find(item => item.weeks.some(segment => segment.week === week));
    if (month) setSelectedMonth(month.month);
  };
  const periodControls = <div aria-label="Contexto del periodo" className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs font-medium">Periodicidad<select aria-label="Periodicidad" className={fieldClass} value={periodMode} onChange={event => changePeriodMode(event.target.value as PeriodMode)}><option value="period">Periodo completo</option><option value="month">Mensual</option><option value="week">Semanal</option></select></label>{periodMode === 'month' ? <label className="grid gap-1 text-xs font-medium">Mes de análisis<select aria-label="Mes de análisis" className={fieldClass} value={selectedMonth || monthlyView.months[0]?.month || ''} onChange={event => selectMonth(event.target.value)}>{monthlyView.months.map(item => <option key={item.month} value={item.month}>{item.label}</option>)}</select></label> : periodMode === 'week' ? selected ? <label className="grid gap-1 text-xs font-medium">Semana de análisis<select aria-label="Semana de análisis" className={fieldClass} value={selected.week} onChange={event => selectWeek(event.target.value)}>{result.weeks.map(week => <option key={week.week} value={week.week}>Desde {shortDate(week.week)}</option>)}</select></label> : <label className="grid gap-1 text-xs font-medium">Semana de análisis<select aria-label="Semana de análisis" className={fieldClass} value="" disabled><option value="">Sin semanas calculables para este mes</option></select></label> : null}<span className="pb-3 text-sm font-medium">{changes ? 'Escenario modificado · sin guardar' : 'Escenario base'}</span>{uncertain && <button type="button" aria-label="Parcial: consultar datos y criterios" className="mb-1 min-h-11 rounded-md border border-stone-300 bg-white px-3 text-sm" onClick={() => setPanel('data')}>Parcial</button>}</div>;
  const comparison = <StaffingComparison baseline={baselineWeek} current={selected} changed={changes} uncertain={uncertain} days={selectedDays} onOpenScenario={() => setPanel('scenario')} />;
  const balancePanel = <StaffingBalance balance={balance} periodLabel={teamPeriodLabel || `Semana del ${shortDate(selected?.week || '')}`} cushionPercent={cushionPercent} onCushion={setCushionPercent} editedIds={editedIds} onWeeklyMinutes={(id, minutes) => changeWorker(id, { weeklyMinutes: minutes })} onRestore={restoreWorker} onApplySuggestion={applySuggestion} />;
  const jumpToView = (view: typeof activeView) => { setActiveView(view); const target = view === 'forecast' ? 'staffing-view-forecast' : view === 'team' ? 'staffing-view-team' : 'staffing-view-scenarios'; window.requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  return <section className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 bg-[#f4f2fa] p-3 text-[#201936] sm:p-6 lg:p-8" aria-label="Previsión de personal">
    <StaffingHeader sedeName={sedeName} dateFrom={dateFrom} dateTo={dateTo} demo={demo}>{controls}<button type="button" className={`${fieldClass} !border-[#310984] !bg-[#310984] !text-white`} onClick={() => setPanel('scenario')}>Simular cambios</button></StaffingHeader>

    {failures.length > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-300 bg-white p-3 text-sm text-rose-900"><span>No se pudieron leer todas las fuentes: la previsión está incompleta, y eso no significa que no haya actividad.</span>{onRetry && <button type="button" className={fieldClass} onClick={onRetry}>Reintentar</button>}<button type="button" className={fieldClass} onClick={() => setPanel('data')}>Ver fuentes fallidas</button></div>}
    <nav aria-label="Secciones de previsión" className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded8eb]">
      <div className="flex flex-wrap items-center gap-1">{[['forecast', 'Previsión'], ['team', 'Equipo'], ['scenarios', 'Escenarios']].map(([value, label], index, links) => <button key={value} id={`staffing-section-tab-${value}`} type="button" aria-current={activeView === value ? 'page' : undefined} className={`min-h-12 border-b-2 px-4 text-sm font-bold transition ${activeView === value ? 'border-[#390b92] text-[#390b92]' : 'border-transparent text-[#716a7d] hover:border-[#c9bce0] hover:text-[#201936]'}`} onClick={() => jumpToView(value as typeof activeView)} onKeyDown={event => { if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length; const nextValue = links[next][0]; jumpToView(nextValue as typeof activeView); document.getElementById(`staffing-section-tab-${nextValue}`)?.focus(); }}>{label}</button>)}</div><button type="button" className="mb-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dcd5e8] bg-white px-3 text-xs font-bold text-[#390b92] shadow-sm" onClick={() => setPanel('data')}>Datos y criterios</button>
    </nav>
    {periodControls}
    <StaffingAttention weeks={attentionWeeks} months={attentionMonths} periodLabel={attentionScope.label} periodSubtitle={attentionScope.subtitle} totals={periodTotals} committedMinutes={teamCommittedMinutes} maxMinutes={periodTotals.capacityMinutes} peak={periodPeak ? { week: periodPeak.week, minutes: periodPeak.knownMinutes + periodPeak.estimatedMinutes } : undefined} overloadedPeriod={overloadedPeriod} unassignedDays={periodMode === 'period' ? [] : periodDays} unassignedScope={periodMode === 'month' ? 'en el mes elegido' : periodMode === 'week' ? 'en la semana elegida' : undefined} workers={simulationData.workers} onWeek={selectWeek} onTeam={() => jumpToView('team')} onScenario={() => jumpToView('scenarios')} uncertain={uncertain} />
    <div id="staffing-view-forecast" aria-label="Vista de previsión">
    {periodMode === 'week' && !selected && <p role="status" className="text-sm text-stone-600">Sin semanas/datos calculables para este mes. Amplía el horizonte técnico o elige otro mes.</p>}
    <p className="text-xs font-medium text-stone-600">{periodMode === 'period' ? 'Periodo completo · resumen de la sede' : periodMode === 'month' ? `Mes ${selectedMonthData?.label || '—'} · resumen mensual de sede` : `Semana ${shortDate(selected?.week || '')} · resumen total de sede`}</p>
    <div className="grid divide-y border-y border-stone-300 py-1 sm:grid-cols-2 sm:divide-x lg:grid-cols-4" aria-label={`Resumen ${periodMode === 'month' ? 'mensual' : periodMode === 'period' ? 'del periodo' : 'semanal'} de sede`}>{[
      ['Trabajo previsto', hours(periodWork), `${hours(periodTotals.knownMinutes)} ya registradas + ${hours(periodTotals.estimatedMinutes)} estimadas`],
      ['Jornada comprometida', hours(teamCommittedMinutes), 'Horas de ficha que se pagan y hay que cubrir'],
      ['Horas posibles del equipo', hours(periodTotals.capacityMinutes), 'Con la disponibilidad registrada y hasta un 30 % más de jornada'],
      [periodGap <= 0 ? 'Jornada sin trabajo asignado' : periodWork <= periodTotals.capacityMinutes ? 'Falta sobre la jornada de ficha' : 'Lo que falta', hours(Math.abs(periodGap <= 0 ? periodGap : periodWork <= periodTotals.capacityMinutes ? periodGap : periodOverCeiling)), periodGap <= 0 ? 'Se paga igual: falta trabajo registrado para esa jornada' : periodWork <= periodTotals.capacityMinutes ? 'Cabe usando el margen de hasta un 30 % más de jornada' : 'Ni con un 30 % más de jornada llega el equipo'],
    ].map(([label, value, detail]) => <div key={label} className="px-3 py-4"><h2 className="text-sm text-stone-600">{label}</h2><p className="my-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p><p className="text-xs text-stone-600">{detail}</p></div>)}</div>
    {(!dataset.services.length || !dataset.workers.length) && <p role="status" className="text-sm text-stone-600">Sin datos suficientes: falta demanda o equipo en este periodo. No se concluye que sobre personal.</p>}
    <StaffingEvolution weeks={result.weeks} months={monthlyView.months} selectedMonth={selectedMonth || monthlyView.months[0]?.month} selectedWeek={selected?.week} onSelect={selectWeek} onMonth={selectMonth} incompleteWeeks={incompleteWeeks} />

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">{selected ? <StaffingDetails dataset={simulationData} result={result} week={selected.week} days={selectedDays} issues={issues} centerFilter={centerFilter} onCenter={setCenterFilter} onSimulate={() => setPanel('scenario')} /> : <p role="status" className={`${panelClass} text-sm text-[#716a7d]`}>Sin semana seleccionada para mostrar el detalle.</p>}<StaffingWeekOptions week={selected} days={selectedDays} onScenario={() => setPanel('scenario')} /></div>
    </div>
    <section id="staffing-view-team" aria-label="Vista de equipo"><StaffingTeam workers={simulationData.workers} days={periodDays} week={selected?.week} periodLabel={teamPeriodLabel} onSimulate={() => setPanel('scenario')} /></section>
    {comparison}
    <section id="staffing-view-scenarios" aria-label="Vista de escenarios" className={activeView === 'scenarios' ? '' : 'hidden'}><section className={`${panelClass} space-y-5`}><header><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Escenarios</p><h2 className="mt-1 text-xl font-bold">Prueba una alternativa antes de decidir</h2><p className="mt-1 text-sm text-[#716a7d]">Los cambios solo afectan a esta simulación y se comparan con el escenario base.</p></header><StaffingScenario workers={simulationData.workers} absence={absenceWorkerId} onAbsence={setAbsenceWorkerId} onChange={changeWorker} onAdd={addReinforcement} onReset={reset} canAdd={!!dataset.centers.length && reinforcements.length < 20} balance={balancePanel}><div aria-label="Resumen de cambios" className="text-xs text-[#716a7d]">{Object.keys(overrides).length} {Object.keys(overrides).length === 1 ? 'persona editada' : 'personas editadas'} · {reinforcements.length} refuerzos · {absenceWorkerId ? '1 ausencia' : 'Sin ausencia adicional'}</div></StaffingScenario></section></section>
    {panel === 'scenario' && <StaffingPanel title="Simular cambios" onClose={() => setPanel(null)}><p className="text-xs text-stone-600">{fullDate(dateFrom)} — {fullDate(dateTo)} · {changes ? 'Escenario modificado' : 'Escenario base'} · {centerFilter ? dataset.centers.find(c => c.id === centerFilter)?.name : 'Todos los centros'}</p><StaffingScenario workers={simulationData.workers} absence={absenceWorkerId} onAbsence={setAbsenceWorkerId} onChange={changeWorker} onAdd={addReinforcement} onReset={reset} canAdd={!!dataset.centers.length && reinforcements.length < 20} balance={balancePanel}>{comparison}<div aria-label="Resumen de cambios" className="text-xs text-stone-600">{Object.keys(overrides).length} {Object.keys(overrides).length === 1 ? 'persona editada' : 'personas editadas'} · {reinforcements.length} refuerzos · {absenceWorkerId ? '1 ausencia' : 'Sin ausencia adicional'}{Object.keys(overrides).map(id => <p key={id}>{simulationData.workers.find(worker => worker.id === id)?.name}: {Object.keys(overrides[id]).map(key => ({ weeklyMinutes: 'horas', restDay: 'libranza', flexibleRest: 'libranza flexible', canMove: 'movilidad', activeTo: 'fin de actividad', costPerHour: 'coste' })[key] || key).join(', ')}</p>)}</div></StaffingScenario><details className={panelClass}><summary className="min-h-11 cursor-pointer text-base font-semibold">Ajustes</summary><div className="mt-3 grid gap-3"><label className="grid gap-1 text-sm">Reservas adicionales a una semana (%)<input aria-label="Margen a una semana" className={fieldClass} type="number" min="0" max="100" value={lateReservePercent} onChange={event => setLateReservePercent(Math.max(0, Math.min(100, Number(event.target.value))))}/></label><label className="grid gap-1 text-sm">Reservas adicionales después de una semana (%)<input aria-label="Escenario lejano" className={fieldClass} type="number" min="0" max="200" value={seasonalPercent} onChange={event => setSeasonalPercent(Math.max(0, Math.min(200, Number(event.target.value))))}/></label><label className="grid gap-1 text-sm">Traslado entre centros (min)<input aria-label="Minutos de traslado" className={fieldClass} type="number" min="0" max="180" value={travelMinutes} onChange={event => setTravelMinutes(Math.max(0, Math.min(180, Number(event.target.value))))}/></label></div><p className="mt-3 text-xs text-stone-600">Hipótesis comunes, no ocupación ni rutas verificadas. La comparación conserva la base 20 % / 0 % / 20 min.</p></details></StaffingPanel>}
    {panel === 'data' && <StaffingPanel title="Datos y criterios" onClose={() => setPanel(null)}><p className="text-sm">Las horas son horas de trabajo. Las horas del equipo son las que puede hacer con lo que hay registrado, no horas recortables. Los servicios sin encaje en el ajuste automático no prueban que su cobertura sea imposible.</p><p className="text-xs text-stone-600">Lectura {dataset.fetchedAt || 'sin fecha'} · {issues.length} incidencias y criterios · total de sede</p><h3 className="font-semibold">Antelación de reservas por proveedor</h3><p className="text-xs text-stone-600">La última salida observada no garantiza cobertura de reservas hasta esa fecha.</p>{dataset.providerCoverage?.map(provider => <article key={provider.provider} className="border-b pb-3 text-sm"><strong>{provider.label}</strong><p>{provider.status === 'unknown' ? 'Fuente no verificable' : provider.status === 'none' ? 'Sin reservas activas observadas' : `${provider.reservations30} reservas en 30 días · ${provider.reservations31to60} entre días 31–60`}</p><p className="text-xs text-stone-600">Última salida observada: {fullDate(provider.latestDate)} · referencia {fullDate(provider.referenceDate)}</p></article>)}{[...new Set(issues.map(issue => issue.code))].map(code => <details key={code} className="border-b text-sm"><summary className="min-h-11 cursor-pointer py-3">{issues.find(issue => issue.code === code)?.message.split(';')[0]} ({issues.filter(issue => issue.code === code).length})</summary><ul className="space-y-2 pb-3 text-xs text-stone-600">{issues.filter(issue => issue.code === code).map((issue, index) => <li key={index}>{issue.centerId ? `${dataset.centers.find(center => center.id === issue.centerId)?.name || 'Centro'}: ` : 'Sede: '}{issue.message}</li>)}</ul></details>)}<details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Inventario mensual</summary><p className="text-xs text-stone-600">Recuentos de tareas, no horas realizadas ni histórico completo.</p><div className="overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Mes</th><th>Tareas</th><th>Completadas</th><th>Sin duración</th></tr></thead><tbody>{dataset.inventory.map(month => <tr key={month.month} className="border-t"><th className="py-3">{month.month}</th><td>{month.tasks}</td><td>{month.completed}</td><td>{month.missingDuration}</td></tr>)}</tbody></table></div></details></StaffingPanel>}
  </section>;
}
