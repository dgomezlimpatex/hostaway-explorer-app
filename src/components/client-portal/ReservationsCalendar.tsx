
import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientReservation } from '@/types/clientPortal';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ReservationsCalendarProps {
  reservations: ClientReservation[];
  isLoading: boolean;
}

export const ReservationsCalendar = ({
  reservations,
  isLoading,
}: ReservationsCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get day of week for first day (0 = Sunday)
  const firstDayOfWeek = days[0].getDay();
  // Adjust for Monday start
  const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  // Get reservations for a specific day
  const getReservationsForDay = (date: Date) => {
    return reservations.filter(r => {
      const checkIn = new Date(r.checkInDate);
      const checkOut = new Date(r.checkOutDate);
      return date >= checkIn && date < checkOut;
    });
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Cargando calendario...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoy
            </Button>
            <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for start padding */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}

          {/* Days */}
          {days.map(day => {
            const dayReservations = getReservationsForDay(day);
            const hasReservations = dayReservations.length > 0;
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "aspect-square p-0.5 border rounded-md flex flex-col",
                  isCurrentDay && "ring-2 ring-primary",
                  hasReservations && "bg-primary/10 border-primary/30"
                )}
              >
                <span className={cn(
                  "text-xs font-medium text-center",
                  isCurrentDay && "text-primary"
                )}>
                  {format(day, 'd')}
                </span>
                
                {/* Reservation indicators */}
                <div className="flex-1 overflow-hidden">
                  {dayReservations.slice(0, 2).map((r, i) => (
                    <div
                      key={r.id}
                      className="text-[9px] truncate px-0.5 bg-primary/20 rounded text-primary mb-0.5"
                      title={r.property?.codigo || r.property?.nombre}
                    >
                      {r.property?.codigo || r.property?.nombre}
                    </div>
                  ))}
                  {dayReservations.length > 2 && (
                    <div className="text-[9px] text-muted-foreground text-center">
                      +{dayReservations.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary/10 border border-primary/30" />
            <span>Con reserva</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border ring-2 ring-primary" />
            <span>Hoy</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
