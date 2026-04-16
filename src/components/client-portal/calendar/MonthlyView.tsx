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

  const propertiesById = useMemo(() => {
    return new Map(properties.map((property) => [property.id, property]));
  }, [properties]);

  // For each property, for each day, determine: isStay, isCheckIn, isCheckOut
  const getDayStatus = (day: Date, propertyId: string) => {
    const cur = new Date(day); cur.setHours(0, 0, 0, 0);
    const propReservations = reservationsByProperty.get(propertyId) ?? [];

    const stayReservations = propReservations.filter(r => {
      const ci = new Date(r.checkInDate); ci.setHours(0, 0, 0, 0);
      const co = new Date(r.checkOutDate); co.setHours(0, 0, 0, 0);
      return cur >= ci && cur < co;
    });

    const checkOutRes = propReservations.filter(r => isSameDay(new Date(r.checkOutDate), day));

    return {
      isStayDay: stayReservations.length > 0,
      isCheckIn: stayReservations.some(r => isSameDay(new Date(r.checkInDate), day)),
      isCheckOut: checkOutRes.length > 0,
      stayReservations,
      checkOutReservations: checkOutRes,
    };
  };

  return (
    <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
      <div className="min-w-[320px]">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/50 rounded-t-xl overflow-hidden">
          {DAY_NAMES.map(d => (
            <div key={d} className="p-1.5 sm:p-2 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className={cn("grid grid-cols-7 border-l border-r border-b border-border/30", wi === weeks.length - 1 && "rounded-b-xl overflow-hidden")}>
            {week.map(day => {
              const inMonth = isSameMonth(day, currentDate);

              // Collect all properties that have activity on this day
              const activeProperties: { propId: string; status: ReturnType<typeof getDayStatus> }[] = [];
              properties.forEach(p => {
                const status = getDayStatus(day, p.id);
                if (status.isStayDay || status.isCheckOut) {
                  activeProperties.push({ propId: p.id, status });
                }
              });

              const MAX_VISIBLE = 3;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-l border-border/30 first:border-l-0 min-h-[72px] sm:min-h-[108px] p-1 sm:p-1.5 flex flex-col",
                    !inMonth && "opacity-30",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    "text-[11px] sm:text-sm font-semibold text-right pr-0.5 sm:pr-1 mb-0.5",
                    isToday(day) ? "text-primary" : "text-foreground"
                  )}>
                    {isToday(day) ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs">
                        {format(day, 'd')}
                      </span>
                    ) : format(day, 'd')}
                  </div>

                  {/* Reservation bars - same style as timeline */}
                  <div className="flex-1 flex flex-col gap-1 sm:gap-1.5">
                    {activeProperties.slice(0, MAX_VISIBLE).map(({ propId, status }) => {
                      const color = colorMap.get(propId);
                      if (!color) return null;
                      const prop = propertiesById.get(propId);
                      const { isStayDay, isCheckIn, isCheckOut } = status;

                      return (
                        <div key={propId} className="relative h-5 sm:h-6">
                          {/* CHECKOUT half-bar: left half */}
                          {isCheckOut && (
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                              <div className="absolute inset-y-0 left-0 flex items-center justify-end cursor-default" style={{
                                width: '50%',
                                backgroundColor: color.bg,
                                borderTop: `2px solid ${color.border}`,
                                borderBottom: `2px solid ${color.border}`,
                                borderRight: `3px solid ${color.text}`,
                                borderTopRightRadius: '8px',
                                borderBottomRightRadius: '8px',
                              }}>
                                <div className="mr-0.5 sm:mr-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm">
                                  <ArrowLeftFromLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                </div>
                              </div>
                            </TooltipTrigger><TooltipContent className="bg-rose-50 border-rose-200">
                              <p className="font-semibold text-rose-700 flex items-center gap-1.5 text-xs">
                                <ArrowLeftFromLine className="h-3 w-3" />Salida — {prop?.codigo} — {format(day, 'd MMM', { locale: es })}
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
                                marginLeft: isCheckIn && !isCheckOut ? '2px' : '0',
                              }}>
                                {isCheckIn && (
                                  <div className="ml-0.5 sm:ml-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                                    <ArrowRightToLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger><TooltipContent>
                              <div className="text-xs">
                                <p className="font-medium">{prop?.codigo} — {prop?.nombre}</p>
                                <p className="text-muted-foreground">
                                  {status.stayReservations.map(r => (
                                    <span key={r.id}>{format(new Date(r.checkInDate), 'd MMM', { locale: es })} → {format(new Date(r.checkOutDate), 'd MMM', { locale: es })}</span>
                                  ))}
                                  {isCheckIn && ' 🟢 Entrada'}
                                </p>
                              </div>
                            </TooltipContent></Tooltip></TooltipProvider>
                          )}
                        </div>
                      );
                    })}
                    {activeProperties.length > MAX_VISIBLE && (
                      <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground text-center leading-none">
                        +{activeProperties.length - MAX_VISIBLE}
                      </span>
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
