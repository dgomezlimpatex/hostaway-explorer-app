
import { useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Calendar, ArrowRightToLine, ArrowLeftFromLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientReservation } from '@/types/clientPortal';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ReservationsCalendarProps {
  reservations: ClientReservation[];
  isLoading: boolean;
}

// Generate consistent colors for properties based on property ID
const PROPERTY_COLORS = [
  { bg: 'hsl(var(--chart-1) / 0.15)', border: 'hsl(var(--chart-1) / 0.4)', text: 'hsl(var(--chart-1))' },
  { bg: 'hsl(var(--chart-2) / 0.15)', border: 'hsl(var(--chart-2) / 0.4)', text: 'hsl(var(--chart-2))' },
  { bg: 'hsl(var(--chart-3) / 0.15)', border: 'hsl(var(--chart-3) / 0.4)', text: 'hsl(var(--chart-3))' },
  { bg: 'hsl(var(--chart-4) / 0.15)', border: 'hsl(var(--chart-4) / 0.4)', text: 'hsl(var(--chart-4))' },
  { bg: 'hsl(var(--chart-5) / 0.15)', border: 'hsl(var(--chart-5) / 0.4)', text: 'hsl(var(--chart-5))' },
];

const getPropertyColor = (propertyId: string, propertyColorMap: Map<string, number>) => {
  if (!propertyColorMap.has(propertyId)) {
    propertyColorMap.set(propertyId, propertyColorMap.size % PROPERTY_COLORS.length);
  }
  return PROPERTY_COLORS[propertyColorMap.get(propertyId)!];
};

export const ReservationsCalendar = ({
  reservations,
  isLoading,
}: ReservationsCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Create a stable color map for properties
  const propertyColorMap = useMemo(() => {
    const map = new Map<string, number>();
    reservations.forEach((r, index) => {
      if (r.propertyId && !map.has(r.propertyId)) {
        map.set(r.propertyId, index % PROPERTY_COLORS.length);
      }
    });
    return map;
  }, [reservations]);

  // Days for week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Get unique properties for timeline view
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

  // Get reservations for a specific property
  const getReservationsForProperty = (propertyId: string) => {
    return reservations.filter(r => r.propertyId === propertyId);
  };

  const goToPrevious = () => setCurrentDate(prev => subWeeks(prev, 1));
  const goToNext = () => setCurrentDate(prev => addWeeks(prev, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getHeaderTitle = () => {
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

  const renderTimelineView = () => {
    if (uniqueProperties.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hay propiedades con reservas para mostrar</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
        <div className="min-w-[600px]">
          {/* Header with days */}
          <div className="grid rounded-t-xl overflow-hidden bg-muted/50" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
            <div className="p-2 sm:p-3 font-semibold text-xs sm:text-sm text-muted-foreground border-r border-border/50">
              Propiedad
            </div>
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-1.5 sm:p-3 text-center border-l border-border/30",
                  isToday(day) && "bg-primary/10"
                )}
              >
                <div className={cn(
                  "text-base sm:text-lg font-bold",
                  isToday(day) ? "text-primary" : "text-foreground"
                )}>
                  {format(day, 'd')}
                </div>
                <div className={cn(
                  "text-[10px] sm:text-xs font-medium uppercase tracking-wide",
                  isToday(day) ? "text-primary/80" : "text-muted-foreground"
                )}>
                  {format(day, 'EEE', { locale: es })}
                </div>
              </div>
            ))}
          </div>

          {/* Property rows */}
          {uniqueProperties.map((property, propIndex) => {
            const propertyReservations = getReservationsForProperty(property.id);
            const color = getPropertyColor(property.id, propertyColorMap);
            const isLastRow = propIndex === uniqueProperties.length - 1;

            return (
              <div
                key={property.id}
                className={cn(
                  "grid border-l border-r border-b border-border/50",
                  isLastRow && "rounded-b-xl overflow-hidden"
                )}
                style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}
              >
                {/* Property name */}
                <div className="p-2 sm:p-3 flex items-center gap-2 sm:gap-3 bg-muted/20 border-r border-border/30">
                  <div 
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 shadow-sm" 
                    style={{ 
                      backgroundColor: color.text,
                      boxShadow: `0 0 0 2px white, 0 0 0 3px ${color.border}`
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate">{property.codigo}</div>
                    <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate hidden sm:block">{property.nombre}</div>
                  </div>
                </div>

                {/* Day cells */}
                {weekDays.map((day, dayIndex) => {
                  const dayReservations = propertyReservations.filter(r => {
                    const checkIn = new Date(r.checkInDate);
                    const checkOut = new Date(r.checkOutDate);
                    checkIn.setHours(0, 0, 0, 0);
                    checkOut.setHours(0, 0, 0, 0);
                    const currentDay = new Date(day);
                    currentDay.setHours(0, 0, 0, 0);
                    return currentDay >= checkIn && currentDay < checkOut;
                  });

                  const hasReservation = dayReservations.length > 0;
                  const isCheckIn = dayReservations.some(r => isSameDay(new Date(r.checkInDate), day));
                  const isCheckOut = propertyReservations.some(r => isSameDay(new Date(r.checkOutDate), day));
                  
                  const nextDay = dayIndex < weekDays.length - 1 ? weekDays[dayIndex + 1] : null;
                  const isLastDayOfReservation = nextDay && dayReservations.some(r => {
                    const checkOut = new Date(r.checkOutDate);
                    checkOut.setHours(0, 0, 0, 0);
                    const nextDayNormalized = new Date(nextDay);
                    nextDayNormalized.setHours(0, 0, 0, 0);
                    return checkOut.getTime() === nextDayNormalized.getTime();
                  });

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-l border-border/30 min-h-[48px] sm:min-h-[60px] flex items-center relative",
                        isToday(day) && "bg-primary/5"
                      )}
                    >
                      {hasReservation && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute inset-y-2 sm:inset-y-3 inset-x-0 flex items-center cursor-default"
                                style={{
                                  backgroundColor: color.bg,
                                  borderTop: `2px solid ${color.border}`,
                                  borderBottom: `2px solid ${color.border}`,
                                  borderLeft: isCheckIn ? `3px solid ${color.text}` : 'none',
                                  borderRight: isLastDayOfReservation ? `3px solid ${color.text}` : 'none',
                                  borderTopLeftRadius: isCheckIn ? '8px' : '0',
                                  borderBottomLeftRadius: isCheckIn ? '8px' : '0',
                                  borderTopRightRadius: isLastDayOfReservation ? '8px' : '0',
                                  borderBottomRightRadius: isLastDayOfReservation ? '8px' : '0',
                                  marginLeft: isCheckIn ? '3px' : '0',
                                  marginRight: isLastDayOfReservation ? '3px' : '0',
                                }}
                              >
                                {isCheckIn && (
                                  <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 ml-0.5 sm:ml-1 shadow-sm">
                                    <ArrowRightToLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                {dayReservations.map(r => (
                                  <div key={r.id} className="text-xs">
                                    <p className="font-medium">{r.property?.nombre}</p>
                                    <p className="text-muted-foreground">
                                      {format(new Date(r.checkInDate), 'd MMM', { locale: es })} → {format(new Date(r.checkOutDate), 'd MMM', { locale: es })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      {isCheckOut && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                "absolute inset-0 flex items-center",
                                hasReservation ? "justify-end pr-0.5 sm:pr-1" : "justify-center"
                              )}>
                                <div className="flex items-center justify-center bg-rose-500 text-white rounded-full w-4 h-4 sm:w-6 sm:h-6 shadow-sm z-10">
                                  <ArrowLeftFromLine className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-rose-50 border-rose-200">
                              <p className="font-semibold text-rose-700 flex items-center gap-1.5">
                                <ArrowLeftFromLine className="h-3.5 w-3.5" />
                                Salida
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b px-3 sm:px-6 pb-3 sm:pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="capitalize text-sm sm:text-xl truncate">
            {getHeaderTitle()}
          </CardTitle>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToToday}
              className="font-medium shadow-sm text-xs px-2 sm:px-3 h-8"
            >
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
        {renderTimelineView()}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5">
              <ArrowRightToLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </div>
            <span className="font-medium text-emerald-700">Entrada</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center justify-center bg-rose-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5">
              <ArrowLeftFromLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </div>
            <span className="font-medium text-rose-700">Salida</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg border-2 border-primary bg-primary/10" />
            <span className="font-medium text-muted-foreground">Hoy</span>
          </div>
          {uniqueProperties.length > 0 && (
            <div className="flex items-center gap-2 sm:gap-3 sm:ml-auto flex-wrap">
              {uniqueProperties.slice(0, 4).map(prop => {
                const color = getPropertyColor(prop.id, propertyColorMap);
                return (
                  <div key={prop.id} className="flex items-center gap-1">
                    <div 
                      className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" 
                      style={{ backgroundColor: color.text }}
                    />
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">{prop.codigo}</span>
                  </div>
                );
              })}
              {uniqueProperties.length > 4 && (
                <span className="text-[10px] sm:text-xs text-muted-foreground">+{uniqueProperties.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
