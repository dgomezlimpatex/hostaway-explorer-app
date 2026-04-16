import { format, isToday, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, ArrowRightToLine, ArrowLeftFromLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClientReservation } from '@/types/clientPortal';
import { PropertyColor } from './propertyColors';

interface TimelineViewProps {
  weekDays: Date[];
  properties: { id: string; codigo: string; nombre: string }[];
  reservations: ClientReservation[];
  colorMap: Map<string, PropertyColor>;
}

export const TimelineView = ({ weekDays, properties, reservations, colorMap }: TimelineViewProps) => {
  if (properties.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No hay propiedades con reservas para mostrar</p>
      </div>
    );
  }

  const getReservationsForProperty = (propertyId: string) =>
    reservations.filter(r => r.propertyId === propertyId);

  return (
    <div className="overflow-x-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
      <div className="min-w-[600px]">
        <div className="grid rounded-t-xl overflow-hidden bg-muted/50" style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
          <div className="p-2 sm:p-3 font-semibold text-xs sm:text-sm text-muted-foreground border-r border-border/50">
            Propiedad
          </div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className={cn("p-1.5 sm:p-3 text-center border-l border-border/30", isToday(day) && "bg-primary/10")}>
              <div className={cn("text-base sm:text-lg font-bold", isToday(day) ? "text-primary" : "text-foreground")}>{format(day, 'd')}</div>
              <div className={cn("text-[10px] sm:text-xs font-medium uppercase tracking-wide", isToday(day) ? "text-primary/80" : "text-muted-foreground")}>{format(day, 'EEE', { locale: es })}</div>
            </div>
          ))}
        </div>

        {properties.map((property, propIndex) => {
          const propertyReservations = getReservationsForProperty(property.id);
          const color = colorMap.get(property.id)!;
          const isLastRow = propIndex === properties.length - 1;

          return (
            <div key={property.id} className={cn("grid border-l border-r border-b border-border/50", isLastRow && "rounded-b-xl overflow-hidden")} style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}>
              <div className="p-2 sm:p-3 flex items-center gap-2 sm:gap-3 bg-muted/20 border-r border-border/30">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color.text, boxShadow: `0 0 0 2px white, 0 0 0 3px ${color.border}` }} />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold truncate">{property.codigo}</div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate hidden sm:block">{property.nombre}</div>
                </div>
              </div>

              {weekDays.map((day, dayIndex) => {
                const dayReservations = propertyReservations.filter(r => {
                  const checkIn = new Date(r.checkInDate); checkIn.setHours(0,0,0,0);
                  const checkOut = new Date(r.checkOutDate); checkOut.setHours(0,0,0,0);
                  const cur = new Date(day); cur.setHours(0,0,0,0);
                  return cur >= checkIn && cur < checkOut;
                });
                const hasReservation = dayReservations.length > 0;
                const isCheckIn = dayReservations.some(r => isSameDay(new Date(r.checkInDate), day));
                const isCheckOut = propertyReservations.some(r => isSameDay(new Date(r.checkOutDate), day));
                const nextDay = dayIndex < weekDays.length - 1 ? weekDays[dayIndex + 1] : null;
                const isLastDayOfReservation = nextDay && dayReservations.some(r => {
                  const co = new Date(r.checkOutDate); co.setHours(0,0,0,0);
                  const nd = new Date(nextDay); nd.setHours(0,0,0,0);
                  return co.getTime() === nd.getTime();
                });

                return (
                  <div key={day.toISOString()} className={cn("border-l border-border/30 min-h-[48px] sm:min-h-[60px] flex items-center relative", isToday(day) && "bg-primary/5")}>
                    {hasReservation && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <div className="absolute inset-y-2 sm:inset-y-3 inset-x-0 flex items-center cursor-default" style={{
                          backgroundColor: color.bg,
                          borderTop: `2px solid ${color.border}`, borderBottom: `2px solid ${color.border}`,
                          borderLeft: isCheckIn ? `3px solid ${color.text}` : 'none',
                          borderRight: isLastDayOfReservation ? `3px solid ${color.text}` : 'none',
                          borderTopLeftRadius: isCheckIn ? '8px' : '0', borderBottomLeftRadius: isCheckIn ? '8px' : '0',
                          borderTopRightRadius: isLastDayOfReservation ? '8px' : '0', borderBottomRightRadius: isLastDayOfReservation ? '8px' : '0',
                          marginLeft: isCheckIn ? '3px' : '0', marginRight: isLastDayOfReservation ? '3px' : '0',
                        }}>
                          {isCheckIn && (
                            <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 ml-0.5 sm:ml-1 shadow-sm">
                              <ArrowRightToLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            </div>
                          )}
                        </div>
                      </TooltipTrigger><TooltipContent>
                        <div className="space-y-1">{dayReservations.map(r => (
                          <div key={r.id} className="text-xs">
                            <p className="font-medium">{r.property?.nombre}</p>
                            <p className="text-muted-foreground">{format(new Date(r.checkInDate), 'd MMM', { locale: es })} → {format(new Date(r.checkOutDate), 'd MMM', { locale: es })}</p>
                          </div>
                        ))}</div>
                      </TooltipContent></Tooltip></TooltipProvider>
                    )}
                    {isCheckOut && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <div className={cn("absolute inset-0 flex items-center", hasReservation ? "justify-end pr-0.5 sm:pr-1" : "justify-center")}>
                          <div className="flex items-center justify-center bg-rose-500 text-white rounded-full w-4 h-4 sm:w-6 sm:h-6 shadow-sm z-10">
                            <ArrowLeftFromLine className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                          </div>
                        </div>
                      </TooltipTrigger><TooltipContent className="bg-rose-50 border-rose-200">
                        <p className="font-semibold text-rose-700 flex items-center gap-1.5"><ArrowLeftFromLine className="h-3.5 w-3.5" />Salida</p>
                      </TooltipContent></Tooltip></TooltipProvider>
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
