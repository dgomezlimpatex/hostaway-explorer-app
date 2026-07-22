import { useMemo, useState } from 'react';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  MinusCircle,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PortalBooking } from '@/types/clientPortal';
import { cn } from '@/lib/utils';
import { ReservationDetailModal } from './ReservationDetailModal';
import {
  filterPortalBookingsByOperationalDay,
  formatPortalTaskTime,
  getPortalOperationalStatus,
  getPortalOperationalStatusLabel,
  summarizePortalOperationalStatuses,
  type PortalOperationalStatus,
} from './portalOperationalView';

interface OperationalDayViewProps {
  clientId: string;
  bookings: PortalBooking[];
  isLoading: boolean;
}

const statusMeta: Record<PortalOperationalStatus, {
  icon: typeof MinusCircle;
  card: string;
  badge: string;
  dot: string;
}> = {
  not_cleaned: {
    icon: MinusCircle,
    card: 'border-slate-200',
    badge: 'border-slate-200 bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
  },
  in_progress: {
    icon: PlayCircle,
    card: 'border-amber-200 bg-amber-50/40',
    badge: 'border-amber-200 bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  cleaned: {
    icon: CheckCircle2,
    card: 'border-emerald-200 bg-emerald-50/35',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
  },
};

export const OperationalDayView = ({ clientId, bookings, isLoading }: OperationalDayViewProps) => {
  const today = useMemo(() => new Date(), []);
  const [selectedDay, setSelectedDay] = useState(format(today, 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<PortalOperationalStatus | 'all'>('all');
  const [detailBooking, setDetailBooking] = useState<PortalBooking | null>(null);

  const selectedDate = parseISO(selectedDay);
  const dayBookings = useMemo(
    () => filterPortalBookingsByOperationalDay(bookings, selectedDay),
    [bookings, selectedDay],
  );
  const summary = useMemo(() => summarizePortalOperationalStatuses(dayBookings), [dayBookings]);
  const visibleBookings = statusFilter === 'all'
    ? dayBookings
    : dayBookings.filter((booking) => getPortalOperationalStatus(booking.taskStatus) === statusFilter);

  const dateStrip = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 3)),
    [selectedDate],
  );

  const moveDay = (delta: number) => {
    setSelectedDay(format(addDays(selectedDate, delta), 'yyyy-MM-dd'));
    setStatusFilter('all');
  };

  if (isLoading) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando la operativa...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:px-5">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => moveDay(-1)} aria-label="Día anterior">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {isSameDay(selectedDate, today) ? 'Hoy' : format(selectedDate, 'EEEE', { locale: es })}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-950 sm:text-xl">
              {format(selectedDate, "d 'de' MMMM", { locale: es })}
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => moveDay(1)} aria-label="Día siguiente">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 p-2 sm:gap-2 sm:p-4">
          {dateStrip.map((date) => {
            const iso = format(date, 'yyyy-MM-dd');
            const active = iso === selectedDay;
            const count = filterPortalBookingsByOperationalDay(bookings, iso).length;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => { setSelectedDay(iso); setStatusFilter('all'); }}
                className={cn(
                  'min-h-16 rounded-2xl px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  active ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
                )}
                aria-pressed={active}
              >
                <span className="block text-[10px] font-semibold uppercase sm:text-xs">{format(date, 'EEE', { locale: es })}</span>
                <span className="mt-0.5 block text-lg font-bold tabular-nums">{format(date, 'd')}</span>
                <span className={cn('mt-0.5 block text-[10px]', active ? 'text-white/65' : 'text-slate-400')}>
                  {count} {count === 1 ? 'limpieza' : 'limpiezas'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <StatusCounter label="No limpia" value={summary.not_cleaned} status="not_cleaned" active={statusFilter === 'not_cleaned'} onClick={() => setStatusFilter(statusFilter === 'not_cleaned' ? 'all' : 'not_cleaned')} />
        <StatusCounter label="En curso" value={summary.in_progress} status="in_progress" active={statusFilter === 'in_progress'} onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')} />
        <StatusCounter label="Limpia" value={summary.cleaned} status="cleaned" active={statusFilter === 'cleaned'} onClick={() => setStatusFilter(statusFilter === 'cleaned' ? 'all' : 'cleaned')} />
      </section>

      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h3 className="font-semibold text-slate-950">Limpiezas previstas</h3>
          <p className="text-xs text-muted-foreground">Ordenadas por la hora prevista de inicio</p>
        </div>
        {statusFilter !== 'all' && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStatusFilter('all')}>
            <RotateCcw className="h-3.5 w-3.5" /> Ver todas
          </Button>
        )}
      </div>

      {visibleBookings.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-white shadow-none">
          <CardContent className="py-14 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 font-medium text-slate-800">
              {dayBookings.length === 0 ? 'No hay limpiezas previstas este día' : 'No hay limpiezas con este estado'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Selecciona otra fecha o cambia el filtro.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleBookings.map((booking) => {
            const status = getPortalOperationalStatus(booking.taskStatus);
            const meta = statusMeta[status];
            const StatusIcon = meta.icon;
            const hasPlannedTime = Boolean(booking.startTime);
            return (
              <article key={booking.id} className={cn('rounded-3xl border bg-white p-4 shadow-sm', meta.card)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {booking.property?.codigo && (
                        <span className="rounded-lg bg-slate-950 px-2 py-1 text-xs font-bold text-white">{booking.property.codigo}</span>
                      )}
                      <Badge variant="outline" className={cn('gap-1.5', meta.badge)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                        {getPortalOperationalStatusLabel(status)}
                      </Badge>
                    </div>
                    <h4 className="mt-2 truncate text-base font-bold text-slate-950">
                      {booking.property?.nombre || 'Apartamento sin identificar'}
                    </h4>
                  </div>
                  <StatusIcon className={cn('h-6 w-6 shrink-0', status === 'cleaned' ? 'text-emerald-600' : status === 'in_progress' ? 'text-amber-600' : 'text-slate-400')} />
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2 rounded-2xl bg-white/75 px-3 py-2.5 ring-1 ring-slate-200/80">
                    <Clock3 className="h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hora prevista</p>
                      <p className="font-semibold tabular-nums text-slate-900">
                        {hasPlannedTime
                          ? `${formatPortalTaskTime(booking.startTime)}${booking.endTime ? ` – ${formatPortalTaskTime(booking.endTime)}` : ''}`
                          : 'Sin hora definida'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-white/75 px-3 py-2.5 ring-1 ring-slate-200/80">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ubicación</p>
                      <p className="truncate font-medium text-slate-800">{booking.property?.direccion || 'Dirección no disponible'}</p>
                    </div>
                  </div>
                </div>

                <Button
                  variant={status === 'cleaned' ? 'default' : 'outline'}
                  className="mt-4 w-full rounded-xl"
                  onClick={() => setDetailBooking(booking)}
                >
                  {status === 'cleaned' ? <Camera className="mr-2 h-4 w-4" /> : <Clock3 className="mr-2 h-4 w-4" />}
                  {status === 'cleaned' ? 'Ver reporte y fotografías' : 'Ver detalle'}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        La información se actualiza automáticamente cada minuto.
      </p>

      <ReservationDetailModal
        booking={detailBooking}
        clientId={clientId}
        open={Boolean(detailBooking)}
        onOpenChange={(open) => { if (!open) setDetailBooking(null); }}
      />
    </div>
  );
};

const StatusCounter = ({
  label,
  value,
  status,
  active,
  onClick,
}: {
  label: string;
  value: number;
  status: PortalOperationalStatus;
  active: boolean;
  onClick: () => void;
}) => {
  const meta = statusMeta[status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border bg-white px-2 py-3 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4',
        active ? 'border-slate-950 ring-1 ring-slate-950' : meta.card,
      )}
      aria-pressed={active}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 sm:text-sm">
        <span className={cn('h-2 w-2 rounded-full', meta.dot)} /> {label}
      </span>
      <span className="mt-1 block text-2xl font-black tabular-nums text-slate-950">{value}</span>
    </button>
  );
};
