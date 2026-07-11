import type { ReactNode } from 'react';
import { AlertTriangle, CalendarDays, ChevronDown, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sede } from '@/types/sede';
import { formatMadridDate } from '@/utils/date';

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
  const statusMessage = isLoading
    ? 'Cargando las limpiezas…'
    : pendingTaskCount === 0
      ? 'No hay limpiezas sin asignar para este día.'
      : `${pendingTaskCount} limpieza${pendingTaskCount === 1 ? '' : 's'} pendiente${pendingTaskCount === 1 ? '' : 's'} de repartir.`;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-3xl items-start justify-center py-4 md:items-center md:py-8">
      <section className="w-full overflow-hidden rounded-3xl border border-[#310984]/10 bg-white shadow-xl shadow-[#310984]/8">
        <div className="border-b border-[#310984]/10 bg-gradient-to-br from-[#faf8ff] to-white p-5 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#efe9fb] px-3 py-1 text-xs font-semibold text-[#310984]">
            <Sparkles className="h-3.5 w-3.5" /> Planificación de limpiezas
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#171321] md:text-3xl">
            ¿Qué día quieres planificar?
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#6b627a] md:text-base">
            Hermes prepara el reparto. Tú lo revisas antes de guardarlo.
          </p>
        </div>

        <div className="space-y-5 p-5 md:p-8">
          <div className={hasSeveralSedes ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#171321]">
                <CalendarDays className="h-4 w-4 text-[#310984]" /> Día
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
                className="min-h-[48px] w-full rounded-xl border border-[#310984]/15 bg-white px-3 text-base text-[#171321] outline-none transition focus-visible:ring-2 focus-visible:ring-[#310984] focus-visible:ring-offset-2"
              />
            </label>

            {hasSeveralSedes && (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#171321]">Sede</span>
                <select
                  data-planning-initial-control
                  aria-label="Sede que quieres planificar"
                  value={activeSede?.id || ''}
                  onChange={(event) => {
                    const nextSede = availableSedes.find((sede) => sede.id === event.target.value);
                    if (nextSede) onSedeChange(nextSede);
                  }}
                  className="min-h-[48px] w-full rounded-xl border border-[#310984]/15 bg-white px-3 text-base text-[#171321] outline-none transition focus-visible:ring-2 focus-visible:ring-[#310984] focus-visible:ring-offset-2"
                >
                  {availableSedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
                </select>
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] px-4 py-3 text-sm text-[#6b627a]">
            <p className="font-medium text-[#171321]">{scopeLabel} · {activeSede?.nombre || 'Sin sede seleccionada'}</p>
            <p className="mt-1">{statusMessage}</p>
            {hasPartialScope && (
              <p className="mt-1 font-semibold text-amber-800">Alcance parcial · {pendingTaskCount} de {totalPendingTaskCount} limpiezas sin asignar.</p>
            )}
          </div>

          {hasBlockingError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
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

          <Button
            data-planning-initial-control
            type="button"
            className="min-h-[50px] w-full bg-[#310984] text-base font-semibold text-white hover:bg-[#26066a]"
            disabled={!canGenerateProposal || hasBlockingError || isLoading}
            onClick={onGenerateProposal}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {isLoading ? 'Cargando limpiezas…' : 'Preparar reparto con Hermes'}
          </Button>

          <details className="group rounded-2xl border border-[#310984]/10 bg-white">
            <summary
              data-planning-initial-control
              className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#310984] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#310984]"
            >
              Opciones avanzadas
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-5 border-t border-[#310984]/10 bg-[#faf8ff] p-4 md:p-5">
              {advancedContent}
            </div>
          </details>
        </div>
      </section>
    </main>
  );
};
