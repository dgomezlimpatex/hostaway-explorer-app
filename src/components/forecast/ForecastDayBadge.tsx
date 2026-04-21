import { useStaffingForecast, ForecastDay } from '@/hooks/useStaffingForecast';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  date: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Badge sutil para mostrar en cabecera de día del calendario cuando
 * la previsión del día es roja o amarilla.
 */
export const ForecastDayBadge = ({ date, className, onClick }: Props) => {
  const { data } = useStaffingForecast(60);
  const day: ForecastDay | undefined = data?.days.find(d => d.date === date);
  if (!day || day.estado === 'green' || day.estado === 'idle') return null;

  const tone =
    day.estado === 'red'
      ? 'text-destructive'
      : 'text-amber-600';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex items-center gap-1 hover:opacity-80', tone, className)}
      title={`Previsión: faltan ${day.deficitHoras}h (${day.deficitPersonas}p)`}
    >
      <AlertTriangle className="h-3 w-3" />
    </button>
  );
};
