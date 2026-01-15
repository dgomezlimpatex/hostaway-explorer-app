
import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Calendar, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientReservation } from '@/types/clientPortal';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface ReservationsCalendarProps {
  reservations: ClientReservation[];
  isLoading: boolean;
}

type ViewMode = 'month' | 'week';

export const ReservationsCalendar = ({
  reservations,
  isLoading,
}: ReservationsCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Days for month view
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Days for week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Get day of week for first day (0 = Sunday)
  const firstDayOfWeek = monthDays[0]?.getDay() || 0;
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

  const goToPrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="capitalize">
            {getHeaderTitle()}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(val) => val && setViewMode(val as ViewMode)}
              className="bg-muted rounded-lg p-1"
            >
              <ToggleGroupItem 
                value="week" 
                aria-label="Vista semanal"
                className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3 py-1.5 text-xs"
              >
                <CalendarDays className="h-4 w-4 mr-1.5" />
                Semana
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="month" 
                aria-label="Vista mensual"
                className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3 py-1.5 text-xs"
              >
                <Calendar className="h-4 w-4 mr-1.5" />
                Mes
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hoy
              </Button>
              <Button variant="ghost" size="icon" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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

        {viewMode === 'month' ? (
          /* Month Calendar grid */
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for start padding */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}

            {/* Days */}
            {monthDays.map(day => {
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
                    {dayReservations.slice(0, 2).map((r) => (
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
        ) : (
          /* Week view - larger cells with more detail */
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayReservations = getReservationsForDay(day);
              const hasReservations = dayReservations.length > 0;
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[140px] p-2 border rounded-lg flex flex-col",
                    isCurrentDay && "ring-2 ring-primary",
                    hasReservations && "bg-primary/5 border-primary/30"
                  )}
                >
                  {/* Day header */}
                  <div className={cn(
                    "text-center mb-2 pb-2 border-b",
                    isCurrentDay && "border-primary/30"
                  )}>
                    <span className={cn(
                      "text-lg font-bold",
                      isCurrentDay && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className={cn(
                      "text-xs text-muted-foreground",
                      isCurrentDay && "text-primary/70"
                    )}>
                      {format(day, 'EEE', { locale: es })}
                    </div>
                  </div>
                  
                  {/* Reservations list */}
                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {dayReservations.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        Sin reservas
                      </div>
                    ) : (
                      dayReservations.map((r) => (
                        <div
                          key={r.id}
                          className="text-xs p-1.5 bg-primary/15 rounded-md border border-primary/20"
                          title={r.property?.nombre}
                        >
                          <div className="font-medium text-primary truncate">
                            {r.property?.codigo || r.property?.nombre}
                          </div>
                          {r.property?.nombre && r.property?.codigo && (
                            <div className="text-muted-foreground truncate text-[10px]">
                              {r.property.nombre}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
