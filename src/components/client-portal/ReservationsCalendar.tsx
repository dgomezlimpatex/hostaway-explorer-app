
import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Calendar, CalendarDays, LayoutList, LogIn, LogOut } from 'lucide-react';
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

  // Get reservations for a specific day with check-in/out info
  const getReservationsForDay = (date: Date) => {
    return reservations.filter(r => {
      const checkIn = new Date(r.checkInDate);
      const checkOut = new Date(r.checkOutDate);
      return date >= checkIn && date < checkOut;
    }).map(r => ({
      ...r,
      isCheckIn: isSameDay(new Date(r.checkInDate), date),
      isCheckOut: isSameDay(new Date(r.checkOutDate), date),
    }));
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
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Cargando calendario...</p>
        </CardContent>
      </Card>
    );
  }

  const renderReservationBadge = (r: ClientReservation & { isCheckIn?: boolean; isCheckOut?: boolean }, compact = false) => {
    const color = getPropertyColor(r.propertyId, propertyColorMap);
    
    return (
      <TooltipProvider key={r.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "rounded-md border transition-all hover:scale-[1.02]",
                compact ? "text-[9px] px-1 py-0.5" : "text-xs p-1.5"
              )}
              style={{
                backgroundColor: color.bg,
                borderColor: color.border,
              }}
            >
              <div className="flex items-center gap-1">
                {r.isCheckIn && (
                  <LogIn className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} style={{ color: color.text }} />
                )}
                {r.isCheckOut && (
                  <LogOut className={cn("shrink-0", compact ? "h-2.5 w-2.5" : "h-3 w-3")} style={{ color: color.text }} />
                )}
                <span className="font-medium truncate" style={{ color: color.text }}>
                  {r.property?.codigo || r.property?.nombre}
                </span>
              </div>
              {!compact && r.property?.nombre && r.property?.codigo && (
                <div className="text-muted-foreground truncate text-[10px]">
                  {r.property.nombre}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <div className="space-y-1">
              <p className="font-medium">{r.property?.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(r.checkInDate), 'd MMM', { locale: es })} → {format(new Date(r.checkOutDate), 'd MMM', { locale: es })}
              </p>
              {r.isCheckIn && <p className="text-xs text-emerald-600 flex items-center gap-1"><LogIn className="h-3 w-3" /> Check-in</p>}
              {r.isCheckOut && <p className="text-xs text-rose-600 flex items-center gap-1"><LogOut className="h-3 w-3" /> Check-out</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderTimelineView = () => {
    if (uniqueProperties.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No hay propiedades con reservas para mostrar
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header with days */}
          <div className="grid" style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}>
            <div className="p-2 border-b font-medium text-sm text-muted-foreground">
              Propiedad
            </div>
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-2 border-b border-l text-center",
                  isToday(day) && "bg-primary/10"
                )}
              >
                <div className={cn(
                  "text-sm font-medium",
                  isToday(day) && "text-primary"
                )}>
                  {format(day, 'd')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(day, 'EEE', { locale: es })}
                </div>
              </div>
            ))}
          </div>

          {/* Property rows */}
          {uniqueProperties.map(property => {
            const propertyReservations = getReservationsForProperty(property.id);
            const color = getPropertyColor(property.id, propertyColorMap);

            return (
              <div
                key={property.id}
                className="grid border-b"
                style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}
              >
                {/* Property name */}
                <div className="p-2 flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full shrink-0" 
                    style={{ backgroundColor: color.text }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{property.codigo}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{property.nombre}</div>
                  </div>
                </div>

                {/* Day cells */}
                {weekDays.map(day => {
                  const dayReservations = propertyReservations.filter(r => {
                    const checkIn = new Date(r.checkInDate);
                    const checkOut = new Date(r.checkOutDate);
                    return day >= checkIn && day < checkOut;
                  }).map(r => ({
                    ...r,
                    isCheckIn: isSameDay(new Date(r.checkInDate), day),
                    isCheckOut: isSameDay(new Date(r.checkOutDate), day),
                  }));

                  const hasReservation = dayReservations.length > 0;
                  const isCheckIn = dayReservations.some(r => r.isCheckIn);
                  const isCheckOut = dayReservations.some(r => r.isCheckOut);

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-1 border-l min-h-[50px] flex items-center justify-center",
                        isToday(day) && "bg-primary/5",
                        hasReservation && "relative"
                      )}
                    >
                      {hasReservation && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "w-full h-8 rounded-md flex items-center justify-center gap-1 cursor-default",
                                  isCheckIn && "rounded-l-full pl-1",
                                  isCheckOut && "rounded-r-full pr-1"
                                )}
                                style={{
                                  backgroundColor: color.bg,
                                  borderTop: `2px solid ${color.border}`,
                                  borderBottom: `2px solid ${color.border}`,
                                  borderLeft: isCheckIn ? `2px solid ${color.border}` : 'none',
                                  borderRight: isCheckOut ? `2px solid ${color.border}` : 'none',
                                }}
                              >
                                {isCheckIn && <LogIn className="h-3 w-3" style={{ color: color.text }} />}
                                {isCheckOut && <LogOut className="h-3 w-3" style={{ color: color.text }} />}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                {dayReservations.map(r => (
                                  <div key={r.id}>
                                    <p className="text-xs">
                                      {format(new Date(r.checkInDate), 'd MMM', { locale: es })} → {format(new Date(r.checkOutDate), 'd MMM', { locale: es })}
                                    </p>
                                    {r.isCheckIn && <p className="text-xs text-emerald-600">Check-in</p>}
                                    {r.isCheckOut && <p className="text-xs text-rose-600">Check-out</p>}
                                  </div>
                                ))}
                              </div>
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
                value="timeline" 
                aria-label="Vista timeline"
                className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3 py-1.5 text-xs"
              >
                <LayoutList className="h-4 w-4 mr-1.5" />
                Timeline
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
        {viewMode === 'timeline' ? (
          renderTimelineView()
        ) : (
          <>
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
                        hasReservations && "bg-muted/50"
                      )}
                    >
                      <span className={cn(
                        "text-xs font-medium text-center",
                        isCurrentDay && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </span>
                      
                      {/* Reservation indicators */}
                      <div className="flex-1 overflow-hidden space-y-0.5">
                        {dayReservations.slice(0, 2).map((r) => renderReservationBadge(r, true))}
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
                        hasReservations && "bg-muted/30"
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
                      <div className="flex-1 space-y-1.5 overflow-y-auto">
                        {dayReservations.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-2">
                            Sin reservas
                          </div>
                        ) : (
                          dayReservations.map((r) => renderReservationBadge(r))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <LogIn className="h-3 w-3 text-emerald-600" />
            <span>Check-in</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LogOut className="h-3 w-3 text-rose-600" />
            <span>Check-out</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border ring-2 ring-primary" />
            <span>Hoy</span>
          </div>
          {uniqueProperties.slice(0, 3).map(prop => {
            const color = getPropertyColor(prop.id, propertyColorMap);
            return (
              <div key={prop.id} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: color.text }}
                />
                <span>{prop.codigo}</span>
              </div>
            );
          })}
          {uniqueProperties.length > 3 && (
            <span className="text-muted-foreground">+{uniqueProperties.length - 3} más</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
