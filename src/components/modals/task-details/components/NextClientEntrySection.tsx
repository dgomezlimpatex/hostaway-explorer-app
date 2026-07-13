import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import {
  formatNextClientEntryLabel,
  loadNextClientEntry,
} from '@/services/clientPortal/nextClientEntry';

interface NextClientEntrySectionProps {
  propertyId: string;
  taskDate: string;
}

export const NextClientEntrySection = ({ propertyId, taskDate }: NextClientEntrySectionProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-next-client-entry', propertyId, taskDate],
    queryFn: () => loadNextClientEntry({ propertyId, taskDate }),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });

  let value = 'Sin próxima reserva';
  let detail = 'No hay entradas futuras registradas en el portal del cliente.';

  if (isLoading) {
    value = 'Consultando…';
    detail = 'Comprobando automáticamente el portal del cliente.';
  } else if (isError) {
    value = 'No disponible';
    detail = 'No se pudo consultar el portal del cliente en este momento.';
  } else if (data) {
    value = formatNextClientEntryLabel(data.checkInDate, taskDate);
    detail = data.checkInDate === taskDate
      ? 'La siguiente entrada coincide con el día de esta tarea.'
      : 'Fecha obtenida automáticamente del portal del cliente.';
  }

  return (
    <section className="space-y-2" aria-label="Siguiente entrada del portal del cliente">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[#310984]" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Reserva
        </h3>
      </div>

      <div className="rounded-md border border-[#310984]/15 bg-[#310984]/5 px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">Siguiente entrada:</span>
          <span className="text-sm font-semibold text-[#310984]" aria-live="polite">
            {value}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </section>
  );
};
