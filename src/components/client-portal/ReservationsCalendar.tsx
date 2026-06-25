import { useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, ChevronLeft, ChevronRight, Clock, Loader2, Calendar, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientReservation, PortalBooking } from '@/types/clientPortal';
import { cn } from '@/lib/utils';
import { buildPropertyColorMap } from './calendar/propertyColors';
import { TimelineView } from './calendar/TimelineView';
import { MonthlyView } from './calendar/MonthlyView';
import { CalendarLegend } from './calendar/CalendarLegend';

interface ReservationsCalendarProps {
  bookings: PortalBooking[];
  isLoading: boolean;
}

// Map a PortalBooking → ClientReservation-shaped record so the existing
// timeline/monthly views can render external tasks (single-day cleanings)
// alongside manual reservations without a deeper refactor.
const bookingToReservation = (b: PortalBooking): ClientReservation => {
  // Prefer the REAL stay dates when available (manual reservations always have
  // them; external/Avantio/Hostaway bookings get them enriched via RPC in
  // useClientPortalBookings). Only fall back to a fake "1-night stay" centered
  // on the cleaning day when no real dates exist (e.g. recurring/manual tasks
  // not linked to any reservation).
  let checkIn = b.checkInDate ?? null;
  let checkOut = b.checkOutDate ?? null;
  if (!checkIn || !checkOut) {
    const cleaning = new Date(b.cleaningDate);
    const dayBefore = new Date(cleaning);
    dayBefore.setDate(dayBefore.getDate() - 1);
    checkIn = dayBefore.toISOString().slice(0, 10);
    checkOut = b.cleaningDate;
  }
  return {
    id: b.id,
    clientId: '',
    propertyId: b.property?.id ?? '',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    guestCount: b.guestCount,
    specialRequests: b.specialRequests,
    taskId: b.taskId,
    status: 'active',
    createdAt: '',
    updatedAt: '',
    property: b.property ? {
      id: b.property.id,
      nombre: b.property.nombre,
      codigo: b.property.codigo,
      direccion: b.property.direccion,
      checkOutPredeterminado: b.property.checkOutPredeterminado ?? '11:00',
    } : undefined,
  };
};

type ViewMode = 'timeline' | 'month';

export const ReservationsCalendar = ({ bookings, isLoading }: ReservationsCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  const reservations = useMemo(
    () => bookings.filter(b => b.property?.id).map(bookingToReservation),
    [bookings],
  );

  const uniqueProperties = useMemo(() => {
    const props = new Map<string, { id: string; codigo: string; nombre: string }>();
    reservations.forEach(r => {
      if (r.propertyId && r.property && !props.has(r.propertyId)) {
        props.set(r.propertyId, {
          id: r.propertyId,
          codigo: r.property.codigo || '',
          nombre: r.property.nombre || ''
        });
      }
    });
    return Array.from(props.values()).sort((a, b) =>
      (a.codigo || a.nombre).localeCompare(b.codigo || b.nombre, 'es', { numeric: true, sensitivity: 'base' })
    );
  }, [reservations]);

  const colorMap = useMemo(
    () => buildPropertyColorMap(uniqueProperties.map(p => p.id)),
    [uniqueProperties]
  );

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const periodRange = useMemo(() => {
    if (viewMode === 'month') {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }

    return {
      start: startOfWeek(currentDate, { weekStartsOn: 1 }),
      end: endOfWeek(currentDate, { weekStartsOn: 1 }),
    };
  }, [currentDate, viewMode]);

  const periodReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      const checkOut = new Date(reservation.checkOutDate);
      return isWithinInterval(checkOut, periodRange);
    });
  }, [periodRange, reservations]);

  const periodProperties = useMemo(() => {
    return new Set(periodReservations.map((reservation) => reservation.propertyId)).size;
  }, [periodReservations]);

  const todayReservations = useMemo(() => {
    return reservations.filter((reservation) => isToday(new Date(reservation.checkOutDate))).length;
  }, [reservations]);

  const goToPrevious = () => {
    setCurrentDate(prev => viewMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1));
  };
  const goToNext = () => {
    setCurrentDate(prev => viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  const getHeaderTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: es });
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM yyyy', { locale: es })}`;
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Cargando calendario...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b bg-gradient-to-br from-white via-blue-50/70 to-slate-50 px-4 pb-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Calendario</p>
            <CardTitle className="mt-1 truncate text-xl font-bold capitalize tracking-tight text-slate-950 sm:text-2xl">
              {getHeaderTitle()}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Revisa visualmente entradas, estancias y salidas por propiedad.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
            <CalendarMetric label="Periodo" value={periodReservations.length} icon={Calendar} />
            <CalendarMetric label="Propiedades" value={periodProperties} icon={Building2} />
            <CalendarMetric label="Hoy" value={todayReservations} icon={Clock} />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-xl border bg-white shadow-sm">
              <button
                onClick={() => setViewMode('timeline')}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                  viewMode === 'timeline' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-slate-50"
                )}
              >
                <LayoutList className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>Semana</span>
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                  viewMode === 'month' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-slate-50"
                )}
              >
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>Mes</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 sm:justify-end sm:gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} className="h-9 rounded-xl bg-white px-3 text-xs font-medium shadow-sm">
              Hoy
            </Button>
            <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-9 w-9 rounded-xl hover:bg-blue-50">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goToNext} className="h-9 w-9 rounded-xl hover:bg-blue-50">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5">
        {viewMode === 'timeline' ? (
          <TimelineView
            weekDays={weekDays}
            properties={uniqueProperties}
            reservations={reservations}
            colorMap={colorMap}
          />
        ) : (
          <MonthlyView
            currentDate={currentDate}
            reservations={reservations}
            properties={uniqueProperties}
            colorMap={colorMap}
          />
        )}
        <CalendarLegend properties={uniqueProperties} colorMap={colorMap} />
      </CardContent>
    </Card>
  );
};

const CalendarMetric = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Calendar;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <Icon className="h-3.5 w-3.5 text-primary" />
    </div>
    <div className="mt-1 text-xl font-bold tabular-nums text-slate-950">{value}</div>
  </div>
);
