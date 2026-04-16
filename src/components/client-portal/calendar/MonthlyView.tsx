import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClientReservation } from '@/types/clientPortal';
import { PropertyColor } from './propertyColors';

interface MonthlyViewProps {
  currentDate: Date;
  reservations: ClientReservation[];
  properties: { id: string; codigo: string; nombre: string }[];
  colorMap: Map<string, PropertyColor>;
}

const DAY_NAMES = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

export const MonthlyView = ({ currentDate, reservations, properties, colorMap }: MonthlyViewProps) => {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  const getReservationsForDay = (day: Date) => {
    return reservations.filter(r => {
      const checkIn = new Date(r.checkInDate); checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(r.checkOutDate); checkOut.setHours(0, 0, 0, 0);
      const d = new Date(day); d.setHours(0, 0, 0, 0);
      // Include check-in day through check-out day
      return d >= checkIn && d <= checkOut;
    });
  };

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

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
              const dayReservations = getReservationsForDay(day);

              // Group by property, max 3 visible dots
              const byProperty = new Map<string, { reservation: ClientReservation; isCheckIn: boolean; isCheckOut: boolean }[]>();
              dayReservations.forEach(r => {
                if (!r.propertyId) return;
                if (!byProperty.has(r.propertyId)) byProperty.set(r.propertyId, []);
                byProperty.get(r.propertyId)!.push({
                  reservation: r,
                  isCheckIn: isSameDay(new Date(r.checkInDate), day),
                  isCheckOut: isSameDay(new Date(r.checkOutDate), day),
                });
              });

              const propertyEntries = Array.from(byProperty.entries());
              const MAX_VISIBLE = 3;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-l border-border/30 first:border-l-0 min-h-[52px] sm:min-h-[72px] p-0.5 sm:p-1 flex flex-col",
                    !inMonth && "opacity-30",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {/* Day number */}
                  <div className={cn(
                    "text-[11px] sm:text-sm font-semibold text-right pr-0.5 sm:pr-1",
                    isToday(day) ? "text-primary" : "text-foreground"
                  )}>
                    {isToday(day) ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs">
                        {format(day, 'd')}
                      </span>
                    ) : format(day, 'd')}
                  </div>

                  {/* Reservation indicators */}
                  <div className="flex-1 flex flex-col gap-0.5 mt-0.5">
                    {propertyEntries.slice(0, MAX_VISIBLE).map(([propId, items]) => {
                      const color = colorMap.get(propId);
                      if (!color) return null;
                      const prop = properties.find(p => p.id === propId);
                      const item = items[0];
                      const isCI = item.isCheckIn;
                      const isCO = item.isCheckOut;

                      return (
                        <TooltipProvider key={propId}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="h-[6px] sm:h-2 rounded-sm cursor-default relative"
                                style={{
                                  backgroundColor: color.bg,
                                  borderLeft: isCI ? `3px solid ${color.text}` : `1px solid ${color.border}`,
                                  borderRight: isCO ? `3px solid ${color.text}` : `1px solid ${color.border}`,
                                  borderTop: `1px solid ${color.border}`,
                                  borderBottom: `1px solid ${color.border}`,
                                  borderRadius: isCI && isCO ? '4px' : isCI ? '4px 0 0 4px' : isCO ? '0 4px 4px 0' : '0',
                                  marginLeft: isCI ? '1px' : '0',
                                  marginRight: isCO ? '1px' : '0',
                                }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                {items.map(({ reservation: r, isCheckIn, isCheckOut }) => (
                                  <div key={r.id} className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.text }} />
                                      <span className="font-semibold">{prop?.codigo}</span>
                                      <span className="text-muted-foreground">— {r.property?.nombre}</span>
                                    </div>
                                    <p className="text-muted-foreground ml-3.5">
                                      {format(new Date(r.checkInDate), 'd MMM', { locale: es })} → {format(new Date(r.checkOutDate), 'd MMM', { locale: es })}
                                      {isCheckIn && ' 🟢 Entrada'}
                                      {isCheckOut && ' 🔴 Salida'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                    {propertyEntries.length > MAX_VISIBLE && (
                      <span className="text-[8px] sm:text-[10px] text-muted-foreground text-center">
                        +{propertyEntries.length - MAX_VISIBLE}
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
