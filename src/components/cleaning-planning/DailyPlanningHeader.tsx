import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, RefreshCw, Sparkles } from 'lucide-react';

interface DailyPlanningHeaderProps {
  activeSedeName?: string;
  rangeLabel: string;
  unassignedCount: number | string;
  decisionCount: number | string;
  capacityLabel: string;
  isLoading?: boolean;
  canGenerateProposal?: boolean;
  onGenerateProposal: () => void;
  onRefresh: () => void;
}

const metricClass = 'rounded-2xl border border-[#310984]/10 bg-white/75 p-4 shadow-sm shadow-[#310984]/5';

export const DailyPlanningHeader = ({
  activeSedeName,
  rangeLabel,
  unassignedCount,
  decisionCount,
  capacityLabel,
  isLoading = false,
  canGenerateProposal = true,
  onGenerateProposal,
  onRefresh,
}: DailyPlanningHeaderProps) => (
  <section className="overflow-hidden rounded-[1.75rem] border border-[#310984]/12 bg-[radial-gradient(circle_at_top_left,_rgba(49,9,132,0.16),_transparent_30%),linear-gradient(135deg,_#ffffff,_#f7f3ff)] p-5 text-[#171321] shadow-xl shadow-[#310984]/10 md:p-7">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-[#310984]/15 bg-white/80 text-[#310984]">
            <CalendarDays className="mr-1 h-3 w-3" /> Plan del día
          </Badge>
          <Badge variant="outline" className="border-[#310984]/12 bg-[#310984]/8 text-[#4a278f]">
            {activeSedeName || 'Sede activa'} · {rangeLabel}
          </Badge>
        </div>

        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#171321] md:text-5xl">
            Planificación diaria de limpiezas
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b627a] md:text-base">
            Empieza por cerrar lo importante: qué limpiezas faltan, qué necesita decisión y qué plan recomienda Hermes antes de confirmar y notificar.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row xl:shrink-0">
        <Button
          className="min-h-[48px] bg-[#310984] px-5 text-white shadow-lg shadow-[#310984]/20 hover:bg-[#4c1bb0]"
          disabled={isLoading || !canGenerateProposal}
          onClick={onGenerateProposal}
        >
          <Sparkles className="mr-2 h-4 w-4" /> Planificar con Hermes
        </Button>
        <Button
          variant="outline"
          className="min-h-[48px] border-[#310984]/15 bg-white/70 text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]"
          disabled={isLoading}
          onClick={onRefresh}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
        </Button>
      </div>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-3">
      <div className={metricClass}>
        <p className="text-xs uppercase tracking-[0.18em] text-[#6b627a]">Sin cubrir</p>
        <p className="mt-2 text-3xl font-semibold text-[#171321]">{isLoading ? '—' : unassignedCount}</p>
        <p className="mt-1 text-xs text-[#6b627a]">Necesitan responsable</p>
      </div>
      <div className={metricClass}>
        <p className="text-xs uppercase tracking-[0.18em] text-[#6b627a]">Requiere decisión</p>
        <p className="mt-2 text-3xl font-semibold text-[#171321]">{isLoading ? '—' : decisionCount}</p>
        <p className="mt-1 text-xs text-[#6b627a]">Casas grandes, riesgos o capacidad</p>
      </div>
      <div className={metricClass}>
        <p className="text-xs uppercase tracking-[0.18em] text-[#6b627a]">Capacidad</p>
        <p className="mt-2 text-3xl font-semibold text-[#171321]">{isLoading ? '—' : capacityLabel}</p>
        <p className="mt-1 text-xs text-[#6b627a]">Carga prevista del equipo</p>
      </div>
    </div>
  </section>
);
