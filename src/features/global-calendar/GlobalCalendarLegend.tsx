import type { ReactNode } from 'react';
import { CircleDashed, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOCK_CLASS, CLEANING_CLASS, CLEANING_ICON, STAY_CLASS, UNKNOWN_CLASS } from './globalCalendarStyles';
import { CLEANING_STATE_LABEL, type CleaningState } from './globalCalendarModel';

const Swatch = ({ className }: { className: string }) => (
  <span aria-hidden className={cn('inline-block h-3.5 w-6 shrink-0 rounded-[4px]', className)} />
);

function Item({ swatch, label, hint }: { swatch: ReactNode; label: string; hint?: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs">
      {swatch}
      <span className="font-medium text-ink">{label}</span>
      {hint && <span className="text-ink-3">({hint})</span>}
    </li>
  );
}

function Line({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-4">
      <h3 className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">{children}</ul>
    </div>
  );
}

const CLEANING_HINT: Record<Exclude<CleaningState, 'unknown'>, string> = {
  pending: 'sin parte iniciado',
  'in-progress': 'parte iniciado',
  completed: 'tarea o parte cerrados',
};

/** Leyenda: estancias en la franja superior de cada fila, limpiezas debajo. Mismas clases que el tablero. */
export function GlobalCalendarLegend({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      <Line title="Estancias">
        <Item swatch={<Swatch className={cn(STAY_CLASS, '[clip-path:polygon(5px_0,100%_0,calc(100%-5px)_100%,0_100%)]')} />} label="Ocupado" hint="de mediodía a mediodía" />
        <Item swatch={<Swatch className={cn(BLOCK_CLASS, 'ring-1 ring-inset ring-warning/40')} />} label="Bloqueo" />
        <Item swatch={<Swatch className="border border-line bg-surface" />} label="Sin reserva registrada" hint="no significa libre" />
        <Item swatch={<Swatch className={cn(UNKNOWN_CLASS, 'border border-line')} />} label="Dato no disponible" hint="fuente no leída" />
      </Line>
      <Line title="Limpiezas">
        {(['pending', 'in-progress', 'completed'] as const).map((state) => {
          const Icon = CLEANING_ICON[state];
          return (
            <Item
              key={state}
              swatch={
                <span aria-hidden className={cn('inline-flex h-4 w-6 shrink-0 items-center justify-center rounded border', CLEANING_CLASS[state])}>
                  <Icon className="h-3 w-3" />
                </span>
              }
              label={CLEANING_STATE_LABEL[state]}
              hint={CLEANING_HINT[state]}
            />
          );
        })}
        <Item
          swatch={
            <span aria-hidden className="inline-flex h-4 w-6 shrink-0 items-center justify-center rounded border border-dashed border-warning/50 text-warning">
              <CircleDashed className="h-3 w-3" />
            </span>
          }
          label="Sin limpieza"
          hint="salida sin limpieza registrada ese día"
        />
        <Item swatch={<span aria-hidden className="mx-2 h-2 w-2 shrink-0 rounded-full bg-warning" />} label="Parte por revisar" />
      </Line>
      <Line title="Cada día">
        <li className="flex items-center gap-1.5 text-xs text-ink-2">
          <LogIn aria-hidden className="h-3.5 w-3.5 text-ink-3" /> entradas
        </li>
        <li className="flex items-center gap-1.5 text-xs text-ink-2">
          <LogOut aria-hidden className="h-3.5 w-3.5 text-ink-3" /> salidas
        </li>
        <li className="flex items-center gap-1.5 text-xs text-ink-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-ink-4" /> limpiezas
        </li>
        <li className="text-xs text-ink-3">Pulsa cualquier bloque o propiedad para ver el detalle.</li>
      </Line>
    </div>
  );
}
