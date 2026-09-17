import { ArrowRight, Minus, Plus, RotateCcw, Target } from 'lucide-react';
import { fieldClass, hours, panelClass } from './presentation';
import type { BalanceResult } from './balance';

interface Props {
  balance: BalanceResult;
  periodLabel: string;
  cushionPercent: number;
  onCushion: (value: number) => void;
  editedIds: Set<string>;
  onWeeklyMinutes: (id: string, minutes: number) => void;
  onRestore: (id: string) => void;
  onApplySuggestion: () => void;
}

export function StaffingBalance({ balance, periodLabel, cushionPercent, onCushion, editedIds, onWeeklyMinutes, onRestore, onApplySuggestion }: Props) {
  const { actualMinutes, targetMinutes, workloadMinutes, differenceMinutes, rows } = balance;
  const missing = differenceMinutes < 0;
  const average = rows.some(row => row.periodMinutes > 0) ? actualMinutes / rows.filter(row => row.periodMinutes > 0).length : 0;
  const people = average > 0 ? Math.abs(differenceMinutes) / average : 0;
  const scale = Math.max(actualMinutes, targetMinutes, 1);
  const addHalfHour = (id: string, weeklyMinutes: number, delta: number) => onWeeklyMinutes(id, Math.max(0, Math.min(60, weeklyMinutes / 60 + delta)) * 60);
  return <section role="region" aria-label="Cuadre de plantilla" className={`${panelClass} space-y-4 border-t-4 border-t-[#390b92]`}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#390b92]">Simulación de personal</p><h3 className="mt-1 text-xl font-bold tracking-tight text-[#201936]">Cuadre de plantilla con la carga</h3><p className="mt-1 text-sm text-[#716a7d]">{periodLabel} · solo simulación: no cambia contratos, libranzas ni tareas reales.</p></div>
      <label className="grid gap-1 text-xs font-medium">Colchón para nuevos servicios
        <select aria-label="Colchón para nuevos servicios" className={fieldClass} value={cushionPercent} onChange={event => onCushion(Number(event.target.value))}>{[0, 10, 15, 20, 25, 30].map(value => <option key={value} value={value}>{value} %</option>)}</select>
      </label>
    </header>
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-[#eeeaf4] bg-[#faf9fc] p-3"><dt className="text-xs font-medium text-[#817a8c]">Carga prevista</dt><dd className="mt-1 text-xl font-bold tabular-nums text-[#201936]">{hours(workloadMinutes)}</dd><dd className="mt-1 text-xs leading-4 text-[#716a7d]">Trabajo del periodo, registrado y estimado</dd></div>
      <div className="rounded-lg border border-[#eeeaf4] bg-[#faf9fc] p-3"><dt className="text-xs font-medium text-[#817a8c]">Objetivo de plantilla</dt><dd className="mt-1 text-xl font-bold tabular-nums text-[#201936]">{hours(targetMinutes)}</dd><dd className="mt-1 text-xs leading-4 text-[#716a7d]">Carga + {cushionPercent} % de colchón</dd></div>
      <div className="rounded-lg border border-[#eeeaf4] bg-[#faf9fc] p-3"><dt className="text-xs font-medium text-[#817a8c]">Plantilla actual</dt><dd className="mt-1 text-xl font-bold tabular-nums text-[#201936]">{hours(actualMinutes)}</dd><dd className="mt-1 text-xs leading-4 text-[#716a7d]">Horas de ficha comprometidas con este escenario</dd></div>
      <div className={`rounded-lg border p-3 ${missing ? 'border-[#f2d6dc] bg-[#fff6f8]' : 'border-[#d9ecdd] bg-[#f5fbf6]'}`}><dt className="text-xs font-medium text-[#817a8c]">{missing ? 'Faltan horas de plantilla' : 'Sobran horas de plantilla'}</dt><dd className={`mt-1 text-xl font-bold tabular-nums ${missing ? 'text-[#ba385c]' : 'text-[#19766d]'}`}>{hours(Math.abs(differenceMinutes))}</dd><dd className="mt-1 text-xs leading-4 text-[#716a7d]">{people > 0.05 ? `Equivale a ${people.toLocaleString('es-ES', { maximumFractionDigits: 1 })} jornadas medias del equipo` : 'Cuadra con la carga prevista'}</dd></div>
    </dl>
    <div className="space-y-2" aria-label="Comparación de plantilla actual y objetivo">
      <div className="h-3 w-full overflow-hidden rounded-full bg-[#eeeaf4]"><div className={`h-full ${missing ? 'bg-[#d34f70]' : differenceMinutes > 0 ? 'bg-[#19766d]' : 'bg-[#390b92]'}`} style={{ width: `${Math.min(100, (Math.min(actualMinutes, scale) / scale) * 100)}%` }} /></div>
      <p className="text-xs text-[#716a7d]">La barra compara <strong>plantilla actual</strong> ({hours(actualMinutes)}) con el <strong>objetivo</strong> ({hours(targetMinutes)}). {missing ? 'Te falta personal para el objetivo: amplía horas, añade refuerzo o ajusta el colchón.' : differenceMinutes > 0 ? 'Tienes más horas de las necesarias: valora reducciones de jornada, fijos discontinuos o servicios adicionales.' : 'Estás en el objetivo.'}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={`${fieldClass} inline-flex items-center gap-2`} onClick={onApplySuggestion}><Target className="h-4 w-4" />Aplicar reparto sugerido</button>
      <p className="self-center text-xs text-[#716a7d]">Reparte la diferencia de forma proporcional. Después puedes retocar persona a persona; nada se guarda.</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">Ajuste rápido de horas por persona para {periodLabel}</caption>
        <thead className="text-xs text-[#817a8c]"><tr><th className="py-2 pr-3">Persona</th><th className="px-3 py-2">Horas semanales</th><th className="px-3 py-2 text-right">Horas del periodo</th><th className="px-3 py-2 text-right">Margen +30 %</th><th className="px-3 py-2">Acciones</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.worker.id} className="border-t border-[#f0edf5]">
          <th className="py-2 pr-3 font-medium text-[#201936]"><span className="block">{row.worker.name}</span>{editedIds.has(row.worker.id) ? <span className="text-xs font-normal text-[#390b92]">Editada en el escenario</span> : <span className="text-xs font-normal text-[#817a8c]">Plantilla</span>}</th>
          <td className="px-3 py-2"><span className="inline-flex items-center gap-1"><button type="button" aria-label={`Quitar media hora a ${row.worker.name}`} className="grid h-8 w-8 place-items-center rounded-md border border-[#dcd7e7] bg-white text-[#390b92]" onClick={() => addHalfHour(row.worker.id, row.weeklyMinutes, -0.5)}><Minus className="h-3.5 w-3.5" /></button><span className="w-20 text-center tabular-nums">{`${(row.weeklyMinutes / 60).toLocaleString('es-ES', { maximumFractionDigits: 2 })} h`}</span><button type="button" aria-label={`Añadir media hora a ${row.worker.name}`} className="grid h-8 w-8 place-items-center rounded-md border border-[#dcd7e7] bg-white text-[#390b92]" onClick={() => addHalfHour(row.worker.id, row.weeklyMinutes, 0.5)}><Plus className="h-3.5 w-3.5" /></button></span></td>
          <td className="px-3 py-2 text-right tabular-nums text-[#4f485b]">{hours(row.periodMinutes)}</td>
          <td className="px-3 py-2 text-right tabular-nums text-[#817a8c]">{hours(row.headroomMinutes)}</td>
          <td className="px-3 py-2"><span className="flex flex-wrap items-center gap-2"><button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#f2d6dc] bg-[#fff6f8] px-2 text-xs font-semibold text-[#ba385c]" onClick={() => onWeeklyMinutes(row.worker.id, 0)}>Al paro</button>{editedIds.has(row.worker.id) ? <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#dcd7e7] bg-white px-2 text-xs font-semibold text-[#390b92]" onClick={() => onRestore(row.worker.id)}><RotateCcw className="h-3.5 w-3.5" />Restaurar</button> : null}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="flex items-start gap-2 text-xs leading-5 text-[#817a8c]"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />Las decisiones laborales (despidos, fijos discontinuos al paro, reducciones de jornada) las tomas tú: aquí solo se ve el efecto de cada ajuste sobre la carga.</p>
  </section>;
}
