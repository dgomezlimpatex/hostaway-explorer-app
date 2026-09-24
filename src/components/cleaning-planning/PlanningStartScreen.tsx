import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Sede } from '@/types/sede';
import { formatMadridDate } from '@/utils/date';
import { PlanningSteps } from './PlanningSteps';

interface PlanningStartScreenProps {
  date: Date;
  activeSede?: Sede | null;
  availableSedes: Sede[];
  pendingTaskCount: number;
  totalPendingTaskCount: number;
  scopeLabel: string;
  isLoading: boolean;
  isError: boolean;
  buildingDataError: boolean;
  canGenerateProposal: boolean;
  onDateChange: (date: Date) => void;
  onSedeChange: (sede: Sede) => void;
  onGenerateProposal: () => void;
  onRetry: () => void;
  advancedContent: ReactNode;
}

const parsePlanningDate = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const PlanningStartScreen = ({
  date,
  activeSede,
  availableSedes,
  pendingTaskCount,
  totalPendingTaskCount,
  scopeLabel,
  isLoading,
  isError,
  buildingDataError,
  canGenerateProposal,
  onDateChange,
  onSedeChange,
  onGenerateProposal,
  onRetry,
  advancedContent,
}: PlanningStartScreenProps) => {
  const hasSeveralSedes = availableSedes.length > 1;
  const hasBlockingError = isError || buildingDataError;
  const hasPartialScope = pendingTaskCount !== totalPendingTaskCount;
  const nothingToPlan = !isLoading && !hasBlockingError && totalPendingTaskCount === 0;
  const hiddenByFilters = !isLoading && !hasBlockingError && totalPendingTaskCount > 0 && pendingTaskCount === 0;
  const statusMessage = isLoading
    ? 'Cargando las limpiezas…'
    : pendingTaskCount === 0
      ? 'No hay limpiezas sin asignar para este día.'
      : `${pendingTaskCount} limpieza${pendingTaskCount === 1 ? '' : 's'} pendiente${pendingTaskCount === 1 ? '' : 's'} de repartir.`;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-3xl items-start justify-center py-4 md:items-center md:py-8">
      <section className="w-full overflow-hidden rounded-lg border border-line bg-white shadow-sober">
        <div className="border-b border-line bg-gradient-to-br from-[#faf8ff] to-white p-5 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-line-soft px-3 py-1 text-xs font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" /> Planificación de limpiezas
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            ¿Qué día quieres planificar?
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-3 md:text-base">
            La app prepara el reparto y tú lo revisas. Nada se guarda hasta que pulses «Guardar reparto».
          </p>
          <PlanningSteps current={1} className="mt-5" />
        </div>

        <div className="space-y-5 p-5 md:p-8">
          <div className={hasSeveralSedes ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <CalendarDays className="h-4 w-4 text-brand" /> Día
              </span>
              <input
                data-planning-initial-control
                aria-label="Día que quieres planificar"
                type="date"
                value={formatMadridDate(date)}
                onChange={(event) => {
                  const nextDate = parsePlanningDate(event.target.value);
                  if (nextDate) onDateChange(nextDate);
                }}
                className="min-h-[48px] w-full rounded-md border border-line bg-white px-3 text-base text-ink outline-none transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              />
            </label>

            {hasSeveralSedes && (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-ink">Sede</span>
                <select
                  data-planning-initial-control
                  aria-label="Sede que quieres planificar"
                  value={activeSede?.id || ''}
                  onChange={(event) => {
                    const nextSede = availableSedes.find((sede) => sede.id === event.target.value);
                    if (nextSede) onSedeChange(nextSede);
                  }}
                  className="min-h-[48px] w-full rounded-md border border-line bg-white px-3 text-base text-ink outline-none transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  {availableSedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink-3">
            <p className="font-medium text-ink">{scopeLabel} · {activeSede?.nombre || 'Sin sede seleccionada'}</p>
            <p className="mt-1">{statusMessage}</p>
            {hasPartialScope && !hiddenByFilters && (
              <p className="mt-1 font-semibold text-amber-800">
                Los filtros activos dejan fuera {totalPendingTaskCount - pendingTaskCount} de {totalPendingTaskCount} limpiezas sin asignar.
              </p>
            )}
          </div>

          {hasBlockingError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{isError ? 'No pudimos cargar las limpiezas.' : 'Faltan datos de equipos.'} Reintenta antes de planificar.</p>
              </div>
              <Button
                data-planning-initial-control
                type="button"
                variant="outline"
                className="mt-3 min-h-[44px] border-red-200 bg-white text-red-800 hover:bg-red-100 hover:text-red-900"
                onClick={onRetry}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
              </Button>
            </div>
          )}

          {hiddenByFilters && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Los filtros activos dejan fuera todas las limpiezas de este día.</p>
              <p className="mt-1">
                Este día tiene {totalPendingTaskCount} limpieza{totalPendingTaskCount === 1 ? '' : 's'} pendiente{totalPendingTaskCount === 1 ? '' : 's'}, pero ningún resultado pasa el filtro.
                Abre «Más filtros y detalles técnicos» y pulsa «Limpiar filtros» para verlas todas.
              </p>
            </div>
          )}

          {nothingToPlan ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5 shrink-0" /> Todo repartido para este día
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                No quedan limpiezas sin asignar en {activeSede?.nombre || 'la sede activa'}. Puedes pasar al día siguiente o ver el día en el calendario.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button

                  type="button"
                  variant="outline"
                  className="min-h-[44px] border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 hover:text-emerald-900"
                  onClick={() => onDateChange(addDays(date, 1))}
                >
                  <ArrowRight className="mr-2 h-4 w-4" /> Ir al día siguiente
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="min-h-[44px] border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 hover:text-emerald-900"
                >
                  <Link to="/calendar">Ver el día en el calendario</Link>
                </Button>
              </div>
            </div>
          ) : (
            <Button
              data-planning-initial-control
              type="button"
              className="min-h-[50px] w-full bg-brand text-base font-semibold text-white hover:bg-ink"
              disabled={!canGenerateProposal || hasBlockingError || isLoading}
              onClick={onGenerateProposal}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {isLoading ? 'Cargando limpiezas…' : 'Preparar el reparto'}
            </Button>
          )}

          <details className="group rounded-lg border border-line bg-white">
            <summary
              data-planning-initial-control
              className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-brand outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
            >
              Más filtros y detalles técnicos
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-5 border-t border-line bg-paper p-4 md:p-5">
              {advancedContent}
            </div>
          </details>
        </div>
      </section>
    </main>
  );
};
