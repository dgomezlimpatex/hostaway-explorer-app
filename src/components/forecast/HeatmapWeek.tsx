import { ForecastDay } from '@/hooks/useStaffingForecast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Sparkles } from 'lucide-react';

interface Props {
  days: ForecastDay[];
  onDayClick: (date: string) => void;
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const cellTone = (day: ForecastDay): string => {
  switch (day.estado) {
    case 'red':
      return 'bg-destructive/10 hover:bg-destructive/20 border-destructive/30';
    case 'yellow':
      return 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30';
    case 'green':
      return 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30';
    default:
      return 'bg-muted/40 hover:bg-muted/60 border-border';
  }
};

const dotTone = (day: ForecastDay) => {
  switch (day.estado) {
    case 'red':
      return 'bg-destructive';
    case 'yellow':
      return 'bg-amber-500';
    case 'green':
      return 'bg-emerald-500';
    default:
      return 'bg-muted-foreground/40';
  }
};

export const HeatmapWeek = ({ days, onDayClick }: Props) => {
  // Reorganizar a grid Lunes-Domingo, alineando primera semana
  // Suponemos `days` empieza en `today`; reagrupamos por semana ISO.
  const grid: (ForecastDay | null)[][] = [];
  if (!days.length) return null;

  // Primer día del grid: lunes anterior o igual al primer día
  const first = new Date(days[0].date + 'T12:00:00');
  const offset = (first.getDay() + 6) % 7; // L=0..D=6
  let currentRow: (ForecastDay | null)[] = Array(offset).fill(null);

  days.forEach(d => {
    currentRow.push(d);
    if (currentRow.length === 7) {
      grid.push(currentRow);
      currentRow = [];
    }
  });
  if (currentRow.length) {
    while (currentRow.length < 7) currentRow.push(null);
    grid.push(currentRow);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground font-medium px-1">
        {DAY_LABELS.map((d, i) => (
          <div key={d} className={cn('text-center', i === 6 && 'text-destructive')}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {grid.flat().map((day, i) =>
          day ? (
            <button
              key={day.date}
              type="button"
              onClick={() => onDayClick(day.date)}
              className={cn(
                'rounded-md border p-2 text-left transition-colors min-h-[88px] flex flex-col justify-between',
                cellTone(day)
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground capitalize">
                  {format(new Date(day.date + 'T12:00:00'), 'd MMM', { locale: es })}
                </span>
                <div className="flex items-center gap-1">
                  {day.isHoliday && <Sparkles className="h-3 w-3 text-amber-600" />}
                  {day.isAnomaly && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                  <span className={cn('h-1.5 w-1.5 rounded-full', dotTone(day))} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold leading-tight">{day.checkoutsTotal}</div>
                <div className="text-[10px] text-muted-foreground">checkouts</div>
              </div>
              {day.cargaHoras > 0 && (
                <div className="space-y-0.5">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all',
                        day.estado === 'red' && 'bg-destructive',
                        day.estado === 'yellow' && 'bg-amber-500',
                        day.estado === 'green' && 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(100, day.cobertura * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {day.capacidadHoras}h / {day.cargaHoras}h
                  </div>
                </div>
              )}
            </button>
          ) : (
            <div key={`empty-${i}`} className="min-h-[88px]" />
          )
        )}
      </div>
    </div>
  );
};
