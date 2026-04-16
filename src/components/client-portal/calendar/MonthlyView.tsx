import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRightToLine, ArrowLeftFromLine } from 'lucide-react';
import { ClientReservation } from '@/types/clientPortal';
import { PropertyColor } from './propertyColors';

interface MonthlyViewProps {
  currentDate: Date;
  reservations: ClientReservation[];
  properties: { id: string; codigo: string; nombre: string }[];
  colorMap: Map<string, PropertyColor>;
}

const DAY_NAMES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

interface PropertyMonthCalendarProps {
  property: { id: string; codigo: string; nombre: string };
  color: PropertyColor;
  weeks: Date[][];
  currentDate: Date;
  reservations: ClientReservation[];
  showHeader: boolean;
}

const PropertyMonthCalendar = ({ property, color, weeks, currentDate, reservations, showHeader }: PropertyMonthCalendarProps) => {
  const getDayStatus = (day: Date) => {
    const cur = new Date(day); cur.setHours(0, 0, 0, 0);

    const stayReservations = reservations.filter(r => {
      const ci = new Date(r.checkInDate); ci.setHours(0, 0, 0, 0);
      const co = new Date(r.checkOutDate); co.setHours(0, 0, 0, 0);
      return cur >= ci && cur < co;
    });

    const checkOutRes = reservations.filter(r => isSameDay(new Date(r.checkOutDate), day));

    return {
      isStayDay: stayReservations.length > 0,
      isCheckIn: stayReservations.some(r => isSameDay(new Date(r.checkInDate), day)),
      isCheckOut: checkOutRes.length > 0,
      stayReservations,
      checkOutReservations: checkOutRes,
    };
  };

  return (
    <div className="space-y-2">
      {/* Property header */}
      <div className="flex items-center gap-2 px-1">
        <div
          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
          style={{ backgroundColor: color.text, boxShadow: `0 0 0 2px white, 0 0 0 3px ${color.border}` }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-bold truncate">{property.codigo}</div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{property.nombre}</div>
        </div>
      </div>

      {/* Calendar grid */}
      <div>
        {showHeader && (
          <div className="grid grid-cols-7 bg-muted/50 rounded-t-xl overflow-hidden">
            {DAY_NAMES.map(d => (
              <div key={d} className="p-1 sm:p-1.5 text-center text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
        )}

        {weeks.map((week, wi) => (
          <div
            key={wi}
            className={cn(
              "grid grid-cols-7 border-l border-r border-b border-border/30",
              !showHeader && wi === 0 && "border-t rounded-t-xl overflow-hidden",
              wi === weeks.length - 1 && "rounded-b-xl overflow-hidden"
            )}
          >
            {week.map(day => {
              const inMonth = isSameMonth(day, currentDate);
              const status = getDayStatus(day);
              const { isStayDay, isCheckIn, isCheckOut } = status;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-l border-border/30 first:border-l-0 min-h-[44px] sm:min-h-[52px] py-0.5 flex flex-col",
                    !inMonth && "opacity-30",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    "text-[10px] sm:text-xs font-semibold text-right px-1 mb-0.5 h-4 sm:h-5 flex items-center justify-end",
                    isToday(day) ? "text-primary" : "text-foreground"
                  )}>
                    {isToday(day) ? (
                      <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary text-primary-foreground text-[9px] sm:text-[10px]">
                        {format(day, 'd')}
                      </span>
                    ) : format(day, 'd')}
                  </div>

                  {/* Reservation bar */}
                  <div className="flex-1 relative">
                    {(isStayDay || isCheckOut) && (
                      <div className="relative h-3.5 sm:h-4 mx-0">
                        {/* CHECKOUT half-bar: left half */}
                        {isCheckOut && (
                          <TooltipProvider><Tooltip><TooltipTrigger asChild>
                            <div className="absolute inset-y-0 flex items-center justify-end cursor-default" style={{
                              left: '-1px',
                              width: 'calc(50% + 1px)',
                              backgroundColor: color.bg,
                              borderTop: `2px solid ${color.border}`,
                              borderBottom: `2px solid ${color.border}`,
                              borderRight: `3px solid ${color.text}`,
                              borderTopRightRadius: '8px',
                              borderBottomRightRadius: '8px',
                            }}>
                              <div className="mr-0.5 flex h-3 w-3 sm:h-3.5 sm:w-3.5 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm">
                                <ArrowLeftFromLine className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                              </div>
                            </div>
                          </TooltipTrigger><TooltipContent className="bg-rose-50 border-rose-200">
                            <p className="font-semibold text-rose-700 flex items-center gap-1.5 text-xs">
                              <ArrowLeftFromLine className="h-3 w-3" />Salida — {property.codigo} — {format(day, 'd MMM', { locale: es })}
                            </p>
                          </TooltipContent></Tooltip></TooltipProvider>
                        )}

                        {/* STAY bar */}
                        {isStayDay && (
                          <TooltipProvider><Tooltip><TooltipTrigger asChild>
                            <div className="absolute inset-y-0 flex items-center cursor-default" style={{
                              left: isCheckOut ? '50%' : '0',
                              right: '0',
                              backgroundColor: color.bg,
                              borderTop: `2px solid ${color.border}`,
                              borderBottom: `2px solid ${color.border}`,
                              borderLeft: isCheckIn ? `3px solid ${color.text}` : 'none',
                              borderTopLeftRadius: isCheckIn ? '8px' : '0',
                              borderBottomLeftRadius: isCheckIn ? '8px' : '0',
                              marginRight: '-2px',
                            }}>
                              {isCheckIn && (
                                <div className="ml-0.5 flex h-3 w-3 sm:h-3.5 sm:w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                                  <ArrowRightToLine className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                </div>
                              )}
                            </div>
                          </TooltipTrigger><TooltipContent>
                            <div className="text-xs">
                              <p className="font-medium">{property.codigo} — {property.nombre}</p>
                              <div className="text-muted-foreground">
                                {status.stayReservations.map(r => (
                                  <div key={r.id}>{format(new Date(r.checkInDate), 'd MMM', { locale: es })} → {format(new Date(r.checkOutDate), 'd MMM', { locale: es })}</div>
                                ))}
                                {isCheckIn && <span>🟢 Entrada</span>}
                              </div>
                            </div>
                          </TooltipContent></Tooltip></TooltipProvider>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const MonthlyView = ({ currentDate, reservations, properties, colorMap }: MonthlyViewProps) => {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  const reservationsByProperty = useMemo(() => {
    const map = new Map<string, ClientReservation[]>();
    reservations.forEach((reservation) => {
      const existing = map.get(reservation.propertyId) ?? [];
      existing.push(reservation);
      map.set(reservation.propertyId, existing);
    });
    return map;
  }, [reservations]);

  // Single property: render one full calendar (no grid wrapper)
  if (properties.length <= 1) {
    const property = properties[0];
    if (!property) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay propiedades con reservas para mostrar</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
        <div className="min-w-[320px]">
          <PropertyMonthCalendar
            property={property}
            color={colorMap.get(property.id)!}
            weeks={weeks}
            currentDate={currentDate}
            reservations={reservationsByProperty.get(property.id) ?? []}
            showHeader={true}
          />
        </div>
      </div>
    );
  }

  // Multiple properties: one mini calendar per property in a responsive grid
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {properties.map((property) => (
        <PropertyMonthCalendar
          key={property.id}
          property={property}
          color={colorMap.get(property.id)!}
          weeks={weeks}
          currentDate={currentDate}
          reservations={reservationsByProperty.get(property.id) ?? []}
          showHeader={true}
        />
      ))}
    </div>
  );
};
