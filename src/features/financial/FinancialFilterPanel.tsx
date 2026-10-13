import { useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import './financialTheme.css';
import { financialName } from './financialFormat';
import type { DirectoryEntry } from './financialSource';
import type { Filters } from './financialModel';
import type { Allocation } from './financialAnalytics';

export type FilterKey = 'clients' | 'properties' | 'workers' | 'buildings' | 'types' | 'categories';
export interface FilterGroupSpec { key: FilterKey; label: string; entries: DirectoryEntry[] }

function Group({ label, entries, selected, onChange }: { label: string; entries: DirectoryEntry[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState('');
  const shown = entries.filter(entry => financialName(entry.name).toLowerCase().includes(query.trim().toLowerCase()));
  return <details className="group rounded-xl border border-[var(--fin-line)] bg-[var(--fin-surface)]">
    <summary className="fin-focus flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
      <span>{label}: {selected.length ? `${selected.length} seleccionados` : 'Todos'}</span>
      <ChevronDown aria-hidden className="fin-muted h-4 w-4 transition-transform duration-300 group-open:rotate-180" />
    </summary>
    <div className="border-t border-[var(--fin-line)] px-3 pb-3 pt-2">
      {entries.length > 8 && <label className="relative mb-2 block"><Search aria-hidden className="fin-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><span className="sr-only">Buscar en {label}</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar" className="fin-focus h-10 w-full rounded-lg border border-[var(--fin-line)] bg-[var(--fin-surface)] pl-9 pr-3 text-sm" /></label>}
      <div className="max-h-56 overflow-y-auto pr-1">
        <button type="button" className="fin-focus mb-1 rounded text-sm underline underline-offset-2" onClick={() => onChange([])}>Mostrar todos</button>
        {shown.map(entry => <label key={entry.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-2 text-sm hover:bg-[var(--fin-sunk)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--fin-ink)]" checked={selected.includes(entry.id)} onChange={event => onChange(event.target.checked ? [...selected, entry.id] : selected.filter(id => id !== entry.id))} />{financialName(entry.name)}</label>)}
        {!shown.length && <p className="fin-muted py-2 text-sm">Sin registros disponibles</p>}
      </div>
    </div>
  </details>;
}

interface Props {
  id: string; open: boolean; filters: Filters; groups: FilterGroupSpec[]; allocation: Allocation;
  onChange: (key: FilterKey, ids: string[]) => void; onDates: (patch: Partial<Pick<Filters, 'start' | 'end'>>) => void; onAllocation: (value: Allocation) => void; onReset: () => void;
}
// Inline and non-modal: the numbers above keep updating while filters change.
export function FinancialFilterPanel({ id, open, filters, groups, allocation, onChange, onDates, onAllocation, onReset }: Props) {
  const field = 'fin-focus h-11 w-full rounded-lg border border-[var(--fin-line)] bg-[var(--fin-surface)] px-3 text-sm';
  return <div id={id} hidden={!open} className="fin-rise">
    <div className="space-y-4 rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-sunk)]/60 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Desde<input type="date" className={`${field} mt-1`} value={filters.start} onChange={event => onDates({ start: event.target.value })} /></label>
        <label className="text-sm font-medium">Hasta<input type="date" className={`${field} mt-1`} value={filters.end} onChange={event => onDates({ end: event.target.value })} /></label>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Filtros visibles">{groups.map(group => <Group key={group.key} label={group.label} entries={group.entries} selected={(filters[group.key] as string[] | undefined) || []} onChange={ids => onChange(group.key, ids)} />)}</div>
      <div className="grid items-end gap-3 border-t border-[var(--fin-line)] pt-4 sm:grid-cols-[minmax(220px,1fr)_2fr]">
        <label className="text-sm font-semibold">Reparto de gastos generales
          <select aria-label="Reparto de gastos generales" className={`${field} mt-1 font-normal`} value={allocation} onChange={event => onAllocation(event.target.value as Allocation)}><option value="none">Sin repartir</option><option value="revenue">Por ingresos</option><option value="services">Por número de servicios</option></select></label>
        <p className="fin-muted text-xs leading-relaxed">Reparto mensual sobre toda la sede antes de aplicar los filtros. Cambia el análisis por cliente y propiedad; el balance total de la empresa se conserva. Los gastos adicionales sin tipo de servicio siguen incluidos según sus vínculos.</p>
      </div>
      <button type="button" className="fin-focus rounded text-sm underline underline-offset-2" onClick={onReset}>Ver todo · mes actual</button>
    </div>
  </div>;
}

export function ActiveFilterChips({ chips, onRemove }: { chips: { key: FilterKey; id: string; label: string }[]; onRemove: (key: FilterKey, id: string) => void }) {
  if (!chips.length) return null;
  return <ul className="fin-rise flex flex-wrap gap-2" aria-label="Filtros activos" style={{ ['--i' as string]: 1 }}>{chips.map(chip => <li key={`${chip.key}:${chip.id}`}>
    <button type="button" onClick={() => onRemove(chip.key, chip.id)} aria-label={`Quitar filtro ${chip.label}`} className="fin-focus inline-flex items-center gap-1.5 rounded-full border border-[var(--fin-line)] bg-[var(--fin-surface)] py-1 pl-3 pr-2 text-[13px] hover:bg-[var(--fin-sunk)]">{chip.label}<X aria-hidden className="h-3.5 w-3.5" /></button></li>)}</ul>;
}
