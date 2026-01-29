
import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Calendar, CalendarDays, LayoutList, ArrowRightToLine, ArrowLeftFromLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientReservation } from '@/types/clientPortal';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ReservationsCalendarProps {
  reservations: ClientReservation[];
  isLoading: boolean;
}

type ViewMode = 'month' | 'week' | 'timeline';

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
  const [viewMode, setViewMode] = useState<ViewMode>('week');

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

  // Get check-ins and check-outs for a specific day
  const getEventsForDay = (date: Date) => {
    const checkIns: ClientReservation[] = [];
    const checkOuts: ClientReservation[] = [];
    
    reservations.forEach(r => {
      if (isSameDay(new Date(r.checkInDate), date)) {
        checkIns.push(r);
      }
      if (isSameDay(new Date(r.checkOutDate), date)) {
        checkOuts.push(r);
      }
    });
    
    return { checkIns, checkOuts };
  };

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
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Cargando calendario...</p>
        </CardContent>
      </Card>
    );
  }

  // Check-in badge (green)
  const renderCheckInBadge = (r: ClientReservation, compact = false) => {
    return (
      <TooltipProvider key={`in-${r.id}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/10 transition-all hover:bg-emerald-500/20",
                compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
              )}
            >
              <ArrowRightToLine className={cn(
                "text-emerald-600 shrink-0",
                compact ? "h-3 w-3" : "h-3.5 w-3.5"
              )} />
              <span className="font-semibold text-emerald-700 truncate">
                {r.property?.codigo || r.property?.nombre}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-emerald-50 border-emerald-200">
            <div className="space-y-1">
              <p className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <ArrowRightToLine className="h-3.5 w-3.5" />
                Entrada
              </p>
              <p className="text-sm text-emerald-700">{r.property?.nombre}</p>
              <p className="text-xs text-emerald-600">
                {format(new Date(r.checkInDate), "d MMMM", { locale: es })}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Check-out badge (red)
  const renderCheckOutBadge = (r: ClientReservation, compact = false) => {
    return (
      <TooltipProvider key={`out-${r.id}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg border-2 border-rose-500/30 bg-rose-500/10 transition-all hover:bg-rose-500/20",
                compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
              )}
            >
              <ArrowLeftFromLine className={cn(
                "text-rose-600 shrink-0",
                compact ? "h-3 w-3" : "h-3.5 w-3.5"
              )} />
              <span className="font-semibold text-rose-700 truncate">
                {r.property?.codigo || r.property?.nombre}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-rose-50 border-rose-200">
            <div className="space-y-1">
              <p className="font-semibold text-rose-800 flex items-center gap-1.5">
                <ArrowLeftFromLine className="h-3.5 w-3.5" />
                Salida
              </p>
              <p className="text-sm text-rose-700">{r.property?.nombre}</p>
              <p className="text-xs text-rose-600">
                {format(new Date(r.checkOutDate), "d MMMM", { locale: es })}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

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
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="min-w-[700px]">
          {/* Header with days */}
          <div className="grid rounded-t-xl overflow-hidden bg-muted/50" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
            <div className="p-3 font-semibold text-sm text-muted-foreground border-r border-border/50">
              Propiedad
            </div>
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-3 text-center border-l border-border/30",
                  isToday(day) && "bg-primary/10"
                )}
              >
                <div className={cn(
                  "text-lg font-bold",
                  isToday(day) ? "text-primary" : "text-foreground"
                )}>
                  {format(day, 'd')}
                </div>
                <div className={cn(
                  "text-xs font-medium uppercase tracking-wide",
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
                style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}
              >
                {/* Property name */}
                <div className="p-3 flex items-center gap-3 bg-muted/20 border-r border-border/30">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm" 
                    style={{ 
                      backgroundColor: color.text,
                      boxShadow: `0 0 0 2px white, 0 0 0 4px ${color.border}`
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{property.codigo}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{property.nombre}</div>
                  </div>
                </div>

                {/* Day cells */}
                {weekDays.map((day, dayIndex) => {
                  // Check if this day is occupied (check-in <= day < check-out)
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
                  
                  // Check if next day starts a new reservation
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
                        "border-l border-border/30 min-h-[60px] flex items-center relative",
                        isToday(day) && "bg-primary/5"
                      )}
                    >
                      {/* Occupied bar */}
                      {hasReservation && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute inset-y-3 inset-x-0 flex items-center cursor-default"
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
                                  marginLeft: isCheckIn ? '4px' : '0',
                                  marginRight: isLastDayOfReservation ? '4px' : '0',
                                }}
                              >
                                {isCheckIn && (
                                  <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full w-5 h-5 ml-1 shadow-sm">
                                    <ArrowRightToLine className="h-3 w-3" />
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
                      
                      {/* Check-out indicator - only shown on actual checkout day */}
                      {isCheckOut && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                "absolute inset-0 flex items-center",
                                hasReservation ? "justify-end pr-1" : "justify-center"
                              )}>
                                <div className="flex items-center justify-center bg-rose-500 text-white rounded-full w-6 h-6 shadow-sm z-10">
                                  <ArrowLeftFromLine className="h-3.5 w-3.5" />
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

  const renderWeekView = () => {
    return (
      <div className="grid grid-cols-7 gap-3">
        {weekDays.map(day => {
          const { checkIns, checkOuts } = getEventsForDay(day);
          const hasEvents = checkIns.length > 0 || checkOuts.length > 0;
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[160px] rounded-xl border-2 flex flex-col transition-all",
                isCurrentDay 
                  ? "border-primary bg-primary/5 shadow-sm" 
                  : hasEvents 
                    ? "border-border bg-card" 
                    : "border-border/50 bg-muted/20"
              )}
            >
              {/* Day header */}
              <div className={cn(
                "text-center py-2 border-b",
                isCurrentDay ? "border-primary/30 bg-primary/10" : "border-border/50"
              )}>
                <span className={cn(
                  "text-2xl font-bold",
                  isCurrentDay ? "text-primary" : "text-foreground"
                )}>
                  {format(day, 'd')}
                </span>
                <div className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  isCurrentDay ? "text-primary/80" : "text-muted-foreground"
                )}>
                  {format(day, 'EEEE', { locale: es })}
                </div>
              </div>
              
              {/* Events */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {/* Check-outs first (morning) */}
                {checkOuts.map(r => renderCheckOutBadge(r))}
                
                {/* Check-ins (afternoon) */}
                {checkIns.map(r => renderCheckInBadge(r))}
                
                {!hasEvents && (
                  <div className="text-xs text-muted-foreground/50 text-center py-4">
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for start padding */}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}

        {/* Days */}
        {monthDays.map(day => {
          const { checkIns, checkOuts } = getEventsForDay(day);
          const hasEvents = checkIns.length > 0 || checkOuts.length > 0;
          const isCurrentDay = isToday(day);

          return (
            <TooltipProvider key={day.toISOString()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "aspect-square p-1 border-2 rounded-lg flex flex-col transition-all cursor-default",
                      isCurrentDay 
                        ? "border-primary bg-primary/10 shadow-sm" 
                        : hasEvents 
                          ? "border-border hover:border-primary/50 hover:bg-muted/50" 
                          : "border-transparent hover:bg-muted/30"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-bold text-center",
                      isCurrentDay ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    {/* Event indicators */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
                      {checkOuts.length > 0 && (
                        <div className="flex items-center justify-center gap-0.5">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          {checkOuts.length > 1 && (
                            <span className="text-[8px] font-bold text-rose-600">
                              {checkOuts.length}
                            </span>
                          )}
                        </div>
                      )}
                      {checkIns.length > 0 && (
                        <div className="flex items-center justify-center gap-0.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          {checkIns.length > 1 && (
                            <span className="text-[8px] font-bold text-emerald-600">
                              {checkIns.length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                {hasEvents && (
                  <TooltipContent side="top" className="max-w-[220px]">
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">
                        {format(day, "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                      {checkOuts.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
                            <ArrowLeftFromLine className="h-3 w-3" />
                            Salidas ({checkOuts.length})
                          </p>
                          {checkOuts.map(r => (
                            <p key={r.id} className="text-xs text-muted-foreground pl-4">
                              {r.property?.codigo} - {r.property?.nombre}
                            </p>
                          ))}
                        </div>
                      )}
                      {checkIns.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                            <ArrowRightToLine className="h-3 w-3" />
                            Entradas ({checkIns.length})
                          </p>
                          {checkIns.map(r => (
                            <p key={r.id} className="text-xs text-muted-foreground pl-4">
                              {r.property?.codigo} - {r.property?.nombre}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="capitalize text-xl">
            {getHeaderTitle()}
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(val) => val && setViewMode(val as ViewMode)}
              className="bg-background/80 backdrop-blur rounded-lg p-1 shadow-sm border"
            >
              <ToggleGroupItem 
                value="week" 
                aria-label="Vista semanal"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm px-3 py-1.5 text-xs font-medium"
              >
                <CalendarDays className="h-4 w-4 mr-1.5" />
                Semana
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="timeline" 
                aria-label="Vista timeline"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm px-3 py-1.5 text-xs font-medium"
              >
                <LayoutList className="h-4 w-4 mr-1.5" />
                Timeline
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="month" 
                aria-label="Vista mensual"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm px-3 py-1.5 text-xs font-medium"
              >
                <Calendar className="h-4 w-4 mr-1.5" />
                Mes
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goToToday}
                className="font-medium shadow-sm"
              >
                Hoy
              </Button>
              <Button variant="ghost" size="icon" onClick={goToPrevious} className="hover:bg-primary/10">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNext} className="hover:bg-primary/10">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {viewMode === 'timeline' ? (
          renderTimelineView()
        ) : viewMode === 'week' ? (
          renderWeekView()
        ) : (
          <>
            {/* Week day headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                <div
                  key={day}
                  className="text-center text-xs font-bold text-muted-foreground py-2 uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>
            {renderMonthView()}
          </>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 mt-6 pt-4 border-t text-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full w-5 h-5">
              <ArrowRightToLine className="h-3 w-3" />
            </div>
            <span className="font-medium text-emerald-700">Entrada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center bg-rose-500 text-white rounded-full w-5 h-5">
              <ArrowLeftFromLine className="h-3 w-3" />
            </div>
            <span className="font-medium text-rose-700">Salida</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg border-2 border-primary bg-primary/10" />
            <span className="font-medium text-muted-foreground">Hoy</span>
          </div>
          {uniqueProperties.length > 0 && (
            <div className="flex items-center gap-3 ml-auto">
              {uniqueProperties.slice(0, 4).map(prop => {
                const color = getPropertyColor(prop.id, propertyColorMap);
                return (
                  <div key={prop.id} className="flex items-center gap-1.5">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: color.text }}
                    />
                    <span className="text-xs font-medium text-muted-foreground">{prop.codigo}</span>
                  </div>
                );
              })}
              {uniqueProperties.length > 4 && (
                <span className="text-xs text-muted-foreground">+{uniqueProperties.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
