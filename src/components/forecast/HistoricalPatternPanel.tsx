import { HistoricalPattern } from '@/hooks/useHistoricalDayPattern';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  pattern: HistoricalPattern;
  isLoading?: boolean;
}

export const HistoricalPatternPanel = ({ pattern, isLoading }: Props) => {
  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Calculando histórico…</div>;
  }
  if (pattern.sampleSize === 0) {
    return <div className="text-xs text-muted-foreground">Sin histórico suficiente para este día.</div>;
  }
  const Icon =
    pattern.pctVsAverage > 5
      ? TrendingUp
      : pattern.pctVsAverage < -5
      ? TrendingDown
      : Minus;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Media histórica</p>
          <p className="text-lg font-semibold">{pattern.avgCheckouts}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mín · Máx</p>
          <p className="text-lg font-semibold">
            {pattern.minCheckouts} · {pattern.maxCheckouts}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Hoy proyectado</p>
          <p className="text-lg font-semibold">{pattern.thisDayCheckouts}</p>
        </div>
      </div>
      <div
        className={cn(
          'flex items-center gap-2 text-xs px-2 py-1.5 rounded-md',
          pattern.isExceptional
            ? 'bg-amber-500/10 text-amber-700'
            : 'bg-muted/50 text-muted-foreground'
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>
          {pattern.pctVsAverage > 0 ? '+' : ''}
          {pattern.pctVsAverage}% vs media de {pattern.sampleSize} ocurrencias previas.
          {pattern.isExceptional && ' Día atípicamente alto.'}
        </span>
      </div>
    </div>
  );
};
