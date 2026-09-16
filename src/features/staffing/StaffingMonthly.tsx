import type { StaffingMonth, StaffingMonthlyView } from './monthly';
import { fieldClass, hours } from './presentation';

function band(month: StaffingMonth): string {
  const low = hours(month.knownMinutes);
  const high = month.estimatedMinutes ? hours(month.knownMinutes + month.estimatedMinutes) : low;
  return low === high ? low : `${low}–${high}`;
}
function monthAbbrev(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-ES', { month: 'short', timeZone: 'Europe/Madrid' }).replace('.', '').toUpperCase();
}
function weekRange(week: StaffingMonth['weeks'][number]): string {
  const start = week.segmentStart.slice(8, 10);
  const end = week.segmentEnd.slice(8, 10);
  const startMonth = monthAbbrev(week.segmentStart);
  const endMonth = monthAbbrev(week.segmentEnd);
  return `${start}–${end} ${startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`}`;
}

export function StaffingMonthly({ view, selectedMonth, selectedWeek, onMonth, onWeek, onOpenScenario, availableWeeks }: {
  view: StaffingMonthlyView;
  selectedMonth?: string;
  selectedWeek?: string;
  onMonth: (month: string) => void;
  onWeek: (week: string) => void;
  onOpenScenario: (week: string) => void;
  availableWeeks: string[];
}) {
  const month = view.months.find(item => item.month === selectedMonth) || view.months[0];
  if (!month) return null;
  const comparableWeek = month.weeks.find(week => week.week >= month.startDate && availableWeeks.includes(week.week));
  const max = Math.max(1, ...view.months.flatMap(item => [item.knownMinutes + item.estimatedMinutes, item.capacityMinutes]));
  const monthScale = Math.max(1, month.knownMinutes + month.estimatedMinutes, month.capacityMinutes);
  const incomplete = (item: StaffingMonth) => item.status === 'future' && item.estimatedMinutes === 0;
  return <section aria-label="Previsión mensual" className="space-y-4">
    <header className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#310984]">Previsión mensual</p></header>
    <div role="tablist" aria-label="Meses de previsión" className="grid min-w-0 gap-3 sm:grid-cols-3">
      {view.months.map(item => <button key={item.month} type="button" role="tab" aria-selected={item.month === month.month} aria-label={`${item.label}: ${hours(item.knownMinutes)} ${incomplete(item) ? 'solo registradas, previsión incompleta' : 'horas de trabajo previsto'}; equipo actual ${hours(item.capacityMinutes)} horas posibles${item.status === 'current-partial' ? ', mes en curso parcial' : ''}`} onClick={() => onMonth(item.month)} className={`min-w-0 rounded-lg border bg-white p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#310984] ${item.month === month.month ? 'border-[#310984] bg-[#f3eff8] ring-1 ring-[#310984]' : 'border-stone-200'}`}>
        <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[#310984]">{item.label}</span><strong className="mt-2 block text-2xl tabular-nums sm:text-3xl">{hours(item.knownMinutes)}</strong><span className="mt-1 block text-xs text-stone-600">{incomplete(item) ? 'Solo registrado · previsión incompleta' : 'Horas de trabajo previsto'}</span><span className="mt-2 block text-xs text-stone-600">{incomplete(item) ? 'No hay estimación adicional validada para este mes.' : `${hours(item.knownMinutes + item.estimatedMinutes)} · Horas de trabajo posibles (hipótesis; la reserva cercana no se extiende automáticamente a todo el horizonte)`}</span><span className="mt-2 block text-xs font-medium text-stone-600">Equipo actual · {hours(item.capacityMinutes)} h posibles</span>
      </button>)}
    </div>
    <article aria-label={`Visión de conjunto de ${month.label}`} className="rounded-lg border border-stone-200 bg-white p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-semibold">{month.label}</h3></div><button type="button" disabled={!comparableWeek} className={`${fieldClass} !border-[#310984] !bg-[#310984] !text-white disabled:cursor-not-allowed disabled:opacity-50`} onClick={() => { if (comparableWeek) onOpenScenario(comparableWeek.week); }}>Comparar escenarios</button></header>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0"><div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="text-stone-600">{incomplete(month) ? 'Solo registrado' : 'Registrado'}</span><strong className="text-2xl tabular-nums">{hours(month.knownMinutes)}</strong></div><div className="relative mt-3 h-5 overflow-hidden rounded-full bg-stone-100" aria-label={`Banda de trabajo ${band(month)} sobre capacidad ${hours(month.capacityMinutes)}`}><span className="absolute inset-y-0 left-0 bg-[#310984]" style={{ width: `${Math.min(100, month.knownMinutes / monthScale * 100)}%` }}/>{month.estimatedMinutes > 0 && <span className="absolute inset-y-0 bg-[#cfc1df]" style={{ left: `${Math.min(100, month.knownMinutes / monthScale * 100)}%`, width: `${Math.min(100, month.estimatedMinutes / monthScale * 100)}%`, backgroundImage: 'repeating-linear-gradient(135deg,#9376ba 0 2px,#e9e0f4 2px 5px)' }}/>}</div><div className="mt-2 flex flex-wrap justify-between gap-2 text-sm"><strong className="text-[#310984]">{incomplete(month) ? 'Solo reservas registradas' : `Banda de trabajo: ${band(month)}`}</strong><span className="font-semibold text-emerald-700">Capacidad potencial: {hours(month.capacityMinutes)}</span></div></div>
        <aside className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><p className="text-xs font-bold uppercase tracking-[0.1em] text-rose-700">Revisar distribución diaria</p><h4 className="mt-2 text-lg font-semibold">Capacidad mensual y encaje diario son distintos</h4><p className="mt-1 text-sm text-stone-600">Puede haber horas suficientes en el total del mes, pero cada servicio debe encajar en su día, horario y centro.</p>{month.criticalDays > 0 && <p className="mt-3 text-xs font-medium text-amber-800">El cálculo no ha encontrado hueco compatible para parte de la carga conocida en {month.criticalDays} día{month.criticalDays === 1 ? '' : 's'}. Son días a revisar; no significa que falte capacidad total del mes.</p>}{month.missingDays > 0 && <p className="mt-2 text-xs font-medium text-amber-800">Resultado parcial: faltan días del rango leído.</p>}</aside>
      </div>
    </article>
    <article aria-label={`Semanas dentro de ${month.label}`} className="rounded-lg border border-stone-200 bg-white p-4 sm:p-6"><header className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-semibold">Dentro de {month.label}</h3></header><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{month.weeks.map(week => <button key={week.week} type="button" disabled={!availableWeeks.includes(week.week)} aria-pressed={week.week === selectedWeek} onClick={() => onWeek(week.week)} className={`min-w-0 rounded-md border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#310984] disabled:cursor-not-allowed disabled:opacity-50 ${week.week === selectedWeek ? 'border-[#310984] bg-[#f3eff8]' : 'border-stone-200 bg-[#faf9fc]'}`}><span className="block text-xs font-bold uppercase text-[#310984]">{weekRange(week)}</span><strong className="mt-2 block text-xl tabular-nums">{week.estimatedMinutes ? `${hours(week.knownMinutes)}–${hours(week.knownMinutes + week.estimatedMinutes)}` : hours(week.knownMinutes)}</strong><span className="mt-1 block text-xs text-stone-600">Capacidad potencial · {hours(week.capacityMinutes)}</span><span className="mt-2 block text-xs text-stone-500">{week.crossesMonth ? 'Semana cruzada · contexto completo disponible' : 'Semana del mes'}{week.criticalDays ? ` · ${week.criticalDays} día${week.criticalDays === 1 ? '' : 's'} a revisar` : ''}</span><span className="mt-3 block h-1.5 rounded-full bg-[#310984]" style={{ width: `${Math.max(4, Math.min(100, (week.knownMinutes + week.estimatedMinutes) / max * 100))}%` }}/></button>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 p-3"><strong>{month.weeks.find(week => week.week === selectedWeek)?.segmentStart || month.weeks[0]?.segmentStart || '—'} → {month.weeks.find(week => week.week === selectedWeek)?.segmentEnd || month.weeks[0]?.segmentEnd || '—'}</strong><button type="button" disabled={!comparableWeek} className={`${fieldClass} !border-[#310984] !bg-[#310984] !text-white disabled:cursor-not-allowed disabled:opacity-50`} onClick={() => { if (comparableWeek) onWeek(comparableWeek.week); }}>Abrir comparación diaria y mapa de centros →</button></div></article>
  </section>;
}
