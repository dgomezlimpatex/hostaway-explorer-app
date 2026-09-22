import { dates, hours, clock, weekday, type ForecastDataset, type ForecastModel } from './forecastContract';
import { absenceName, coverageLabel, ledgerLabel, normalize, personName, scopedTasks, viewScope, within, type ViewScope } from './forecastPresentation';

export type ForecastReportType = 'hours' | 'coverage' | 'absences';
export interface ReportRow { key: string; cells: (string | number)[]; workerId?: string; date?: string }
export function buildReport(dataset: ForecastDataset, model: ForecastModel, month: string, type: ForecastReportType, query = '', status = '', order = '') {
  const scope = viewScope(model.context, new URLSearchParams({ focusMonth: month }));
  const ledgers = model.ledgers.filter(l => l.month === month && model.visibleWorkerIds.includes(l.workerId) && (status === 'Excluido' ? l.status === 'Excluido' : l.status !== 'Excluido') && (!status || status === l.status) && normalize(dataset.workers.find(w => w.id === l.workerId)?.name ?? '').includes(normalize(query)));
  let headings: string[], rows: ReportRow[];
  if (type === 'hours') {
    headings = ['Persona', 'Estado', 'Objetivo (h)', 'Computadas (h)', 'Futuras asignadas (h)', 'Otros servicios incluidos (h)', 'Por completar (h)'];
    rows = ledgers.map(l => ({ key: l.workerId, workerId: l.workerId, cells: [personName(dataset.workers.find(w => w.id === l.workerId)?.name ?? 'Persona por identificar'), ledgerLabel(l.status), l.status === 'No verificable' ? 'Por verificar' : l.target / 60, l.computed / 60, l.future / 60, l.other / 60, l.status === 'No verificable' ? 'Por verificar' : l.missing / 60] }));
  } else if (type === 'coverage') {
    headings = ['Fecha', 'Tareas', 'Sin asignar', 'Trabajo conocido (h)', 'Sin encaje (h)', 'Evaluación'];
    rows = model.days.filter(d => within(d.date, scope)).map(d => ({ key: d.date, date: d.date, cells: [d.date, scopedTasks(model, { ...scope, from: d.date, to: d.date }).length, d.unassigned, d.known / 60, d.uncovered / 60, coverageLabel(model, { ...scope, from: d.date, to: d.date })] }));
  } else {
    headings = ['Persona', 'Desde', 'Hasta', 'Categoría', 'Tipo', 'Franja', 'Efecto'];
    rows = dataset.absences.filter(a => a.from <= scope.to && a.to >= scope.from && ledgers.some(l => l.workerId === a.workerId)).map(a => ({ key: a.id, workerId: a.workerId, date: a.from, cells: [personName(dataset.workers.find(w => w.id === a.workerId)?.name ?? 'Persona por identificar'), a.from, a.to, a.type === 'external_work' ? 'Servicio' : 'Ausencia', absenceName(a.type), a.start === undefined && a.end === undefined ? 'Día completo' : `${clock(a.start ?? NaN)}–${clock(a.end ?? NaN)}`, a.type === 'external_work' ? a.start !== undefined && a.end !== undefined ? `${hours(a.end - a.start)} por día registrado; incluido en balance` : 'Cómputo por verificar' : a.type === 'day_off' ? 'Bloquea disponibilidad; sin doble descuento' : a.start !== undefined || a.end !== undefined ? 'Ajuste parcial por verificar' : 'Ajuste según días laborables; ver balance mensual'] }));
    for (const ledger of ledgers) {
      const worker = dataset.workers.find(w => w.id === ledger.workerId)!;
      for (const [i, slot] of (worker.blockedSlots ?? []).entries()) for (const date of dates(scope.from, scope.to)) if ((slot.date ? slot.date === date : slot.day === weekday(date)) && (!worker.activeFrom || date >= worker.activeFrom) && (!worker.activeTo || date <= worker.activeTo)) rows.push({ key: `${worker.id}:${i}:${date}`, workerId: worker.id, date, cells: [personName(worker.name), date, date, slot.consumesContract ? 'Servicio' : 'Indisponibilidad', slot.consumesContract ? 'Mantenimiento' : 'Compromiso registrado', `${clock(slot.startMinute)}–${clock(slot.endMinute)}`, slot.consumesContract ? `${hours(slot.endMinute - slot.startMinute)} de franja; incluido sin duplicar solapes en balance` : 'Bloquea disponibilidad'] });
    }
    rows.sort((a, b) => a.date!.localeCompare(b.date!) || String(a.cells[0]).localeCompare(String(b.cells[0]), 'es'));
  }
  rows.sort((a, b) => {
    const name = () => String(a.cells[0]).localeCompare(String(b.cells[0]), 'es', { numeric: true });
    if (type === 'hours') {
      if (order === 'pending') {
        const missing = (row: ReportRow) => typeof row.cells[6] === 'number' && Number.isFinite(row.cells[6]) ? row.cells[6] : -Infinity;
        const difference = missing(b) - missing(a);
        if (difference) return difference;
      }
      if (order === 'status') return String(a.cells[1]).localeCompare(String(b.cells[1]), 'es') || name();
      return name();
    }
    if (type === 'absences' && order === 'name') return name() || a.date!.localeCompare(b.date!);
    return (order === 'latest' ? b.date!.localeCompare(a.date!) : a.date!.localeCompare(b.date!)) || name();
  });
  const total = (column: number) => rows.some(r => typeof r.cells[column] !== 'number' || !Number.isFinite(r.cells[column])) ? 'Por verificar' : rows.reduce((sum, r) => sum + Number(r.cells[column]), 0);
  const totals = !rows.length || type === 'absences' ? undefined : type === 'hours'
    ? ['Total del filtro', ledgers.some(l => l.status === 'No verificable') ? 'Evaluación parcial' : 'Ver detalle individual', ...[2, 3, 4, 5, 6].map(total)]
    : ['Total del filtro', ...[1, 2, 3, 4].map(total), 'Ver evaluación de cada día'];
  return { headings, rows, totals, scope, query, status, evaluated: ledgers.filter(l => l.status !== 'No verificable').length, unknown: ledgers.filter(l => l.status === 'No verificable').length };
}
export function reportCsvRows(report: ReturnType<typeof buildReport>, context: { sede: string; center: string; scenario: string; rules: string; issues: number }) {
  return [
    ['Sede', context.sede], ['Periodo', report.scope.label], ['Centro', context.center], ['Escenario', context.scenario], ['Reglas', context.rules],
    ['Búsqueda', report.query || 'Sin búsqueda'], ['Estado del balance', report.status ? ledgerLabel(report.status) : 'Plantilla incluida'],
    ['Limitaciones', `${context.issues} avisos de datos; ${report.unknown} personas por verificar. Computadas no significa ejecución confirmada. Propuestas excluidas del balance individual. Los balances personales incluyen todos sus centros.`],
    [], report.headings, ...report.rows.map(r => r.cells), ...(report.totals ? [report.totals] : []),
  ];
}
