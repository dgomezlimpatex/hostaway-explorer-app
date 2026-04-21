import { Card } from '@/components/ui/card';
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ForecastDay } from '@/hooks/useStaffingForecast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  totalDays: number;
  redDays: number;
  yellowDays: number;
  greenDays: number;
  worstDay?: ForecastDay;
  anomalies: number;
}

export const ForecastSummaryStats = ({
  totalDays,
  redDays,
  yellowDays,
  greenDays,
  worstDay,
  anomalies,
}: Props) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="p-4 border-l-4 border-l-destructive">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Días en rojo</p>
            <p className="text-2xl font-semibold">{redDays}</p>
            <p className="text-xs text-muted-foreground">de {totalDays}</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
      </Card>

      <Card className="p-4 border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ajustados</p>
            <p className="text-2xl font-semibold">{yellowDays}</p>
            <p className="text-xs text-muted-foreground">cobertura 90-110%</p>
          </div>
          <TrendingDown className="h-5 w-5 text-amber-500" />
        </div>
      </Card>

      <Card className="p-4 border-l-4 border-l-emerald-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Holgados</p>
            <p className="text-2xl font-semibold">{greenDays}</p>
            <p className="text-xs text-muted-foreground">capacidad &gt;110%</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Peor día</p>
          {worstDay ? (
            <>
              <p className="text-lg font-semibold capitalize">
                {format(new Date(worstDay.date + 'T12:00:00'), "EEE d MMM", { locale: es })}
              </p>
              <p className="text-xs text-destructive">
                Faltan {worstDay.deficitHoras}h ({worstDay.deficitPersonas}p)
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-emerald-600">Todo cubierto</p>
          )}
          {anomalies > 0 && (
            <p className="text-xs text-amber-600 mt-1">{anomalies} día(s) con datos anómalos</p>
          )}
        </div>
      </Card>
    </div>
  );
};
