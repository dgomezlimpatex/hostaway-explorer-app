import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDayForecast } from '@/hooks/useStaffingForecast';
import { useStaffingCandidates } from '@/hooks/useStaffingCandidates';
import { useHistoricalDayPattern } from '@/hooks/useHistoricalDayPattern';
import { CandidateWorkerCard } from './CandidateWorkerCard';
import { HistoricalPatternPanel } from './HistoricalPatternPanel';
import { AlertTriangle, Users, Clock, TrendingUp, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface Props {
  date: string | null;
  onClose: () => void;
}

export const DayDeficitDrawer = ({ date, onClose }: Props) => {
  const { day } = useDayForecast(date);
  const { data: candidates, isLoading: loadingCandidates } = useStaffingCandidates(date);
  const { data: pattern, isLoading: loadingPattern } = useHistoricalDayPattern(
    date,
    day?.checkoutsTotal ?? 0
  );

  if (!date) return null;

  const stateLabel = !day
    ? 'Cargando…'
    : day.estado === 'red'
    ? 'Déficit crítico'
    : day.estado === 'yellow'
    ? 'Cobertura ajustada'
    : day.estado === 'green'
    ? 'Cubierto con holgura'
    : 'Sin carga prevista';

  const stateClass =
    day?.estado === 'red'
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : day?.estado === 'yellow'
      ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
      : day?.estado === 'green'
      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
      : 'bg-muted text-muted-foreground border-border';

  const topCandidates = (candidates ?? []).filter(c => !c.hasAbsence).slice(0, 8);

  return (
    <Sheet open={!!date} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="capitalize">
            {date && format(new Date(date + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </SheetTitle>
          <SheetDescription>
            <Badge className={cn('border', stateClass)} variant="outline">
              {stateLabel}
            </Badge>
            {day?.isHoliday && <Badge variant="outline" className="ml-2">Festivo</Badge>}
            {day?.isAnomaly && (
              <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-700">
                <AlertTriangle className="h-3 w-3 mr-1" /> Datos anómalos
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        {day && (
          <div className="mt-4 space-y-5">
            {/* Resumen */}
            <section>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" /> Checkouts
                  </p>
                  <p className="text-2xl font-semibold">{day.checkoutsTotal}</p>
                  <p className="text-xs text-muted-foreground">
                    {day.checkoutsAvantio} Avantio · {day.checkoutsInternos} internos
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Carga prevista
                  </p>
                  <p className="text-2xl font-semibold">{day.cargaHoras}h</p>
                  <p className="text-xs text-muted-foreground">
                    Capacidad: {day.capacidadHoras}h
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Plantilla
                  </p>
                  <p className="text-2xl font-semibold">
                    {day.workersAvailable}
                    <span className="text-sm text-muted-foreground"> / {day.minWorkersTarget}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {day.workersAbsent > 0 && `${day.workersAbsent} ausencia(s)`}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Déficit
                  </p>
                  <p
                    className={cn(
                      'text-2xl font-semibold',
                      day.deficitHoras > 0 ? 'text-destructive' : 'text-emerald-600'
                    )}
                  >
                    {day.deficitHoras > 0 ? `${day.deficitHoras}h` : 'OK'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {day.deficitPersonas > 0
                      ? `≈ ${day.deficitPersonas} persona(s) extra`
                      : 'Cobertura suficiente'}
                  </p>
                </div>
              </div>
            </section>

            {/* Sugerencias */}
            <section className="space-y-2 pt-2 border-t border-border">
              <h3 className="text-sm font-semibold">Candidatas para reforzar</h3>
              {loadingCandidates ? (
                <p className="text-xs text-muted-foreground">Calculando ranking…</p>
              ) : topCandidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin candidatas disponibles.</p>
              ) : (
                <div className="space-y-2">
                  {topCandidates.map(c => (
                    <CandidateWorkerCard
                      key={c.cleanerId}
                      candidate={c}
                      onPropose={() =>
                        toast({
                          title: 'Propuesta registrada',
                          description: `Recuerda crear el turno extra para ${c.name} en el calendario.`,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Patrones históricos */}
            <section className="space-y-2 pt-2 border-t border-border">
              <h3 className="text-sm font-semibold">Patrón histórico</h3>
              {pattern && <HistoricalPatternPanel pattern={pattern} isLoading={loadingPattern} />}
            </section>

            {/* Acciones */}
            <section className="pt-2 border-t border-border flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/calendar">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir calendario
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/workload">
                  <Users className="h-3.5 w-3.5 mr-1" /> Carga de trabajo
                </Link>
              </Button>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
