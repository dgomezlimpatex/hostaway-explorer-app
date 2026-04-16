import { useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Calendar, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientReservation } from '@/types/clientPortal';
import { cn } from '@/lib/utils';
import { buildPropertyColorMap } from './calendar/propertyColors';
import { TimelineView } from './calendar/TimelineView';
import { MonthlyView } from './calendar/MonthlyView';
import { CalendarLegend } from './calendar/CalendarLegend';

interface ReservationsCalendarProps {
  reservations: ClientReservation[];
  isLoading: boolean;
}

type ViewMode = 'timeline' | 'month';

export const ReservationsCalendar = ({ reservations, isLoading }: ReservationsCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

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
    return Array.from(props.values());
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
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b px-3 sm:px-6 pb-3 sm:pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="capitalize text-sm sm:text-xl truncate">
            {getHeaderTitle()}
          </CardTitle>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* View toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden bg-background shadow-sm">
              <button
                onClick={() => setViewMode('timeline')}
                className={cn(
                  "px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium transition-colors flex items-center gap-1",
                  viewMode === 'timeline' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <LayoutList className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Semana</span>
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={cn(
                  "px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium transition-colors flex items-center gap-1",
                  viewMode === 'month' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Mes</span>
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={goToToday} className="font-medium shadow-sm text-xs px-2 sm:px-3 h-8">
              Hoy
            </Button>
            <Button variant="ghost" size="icon" onClick={goToPrevious} className="hover:bg-primary/10 h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goToNext} className="hover:bg-primary/10 h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
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
