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

              {weekDays.map((day) => {
                const cur = new Date(day); cur.setHours(0,0,0,0);

                // Active stay: checkIn <= day < checkOut
                const stayReservations = propertyReservations.filter(r => {
                  const ci = new Date(r.checkInDate); ci.setHours(0,0,0,0);
                  const co = new Date(r.checkOutDate); co.setHours(0,0,0,0);
                  return cur >= ci && cur < co;
                });
                const isStayDay = stayReservations.length > 0;
                const isCheckIn = stayReservations.some(r => isSameDay(new Date(r.checkInDate), day));

                // Checkout: day === checkOut
                const checkOutRes = propertyReservations.filter(r => isSameDay(new Date(r.checkOutDate), day));
                const isCheckOut = checkOutRes.length > 0;

                // Is next day the checkout? (for connecting bar to checkout half)
                const isLastFullDay = stayReservations.some(r => {
                  const co = new Date(r.checkOutDate); co.setHours(0,0,0,0);
                  const tomorrow = new Date(cur); tomorrow.setDate(tomorrow.getDate() + 1);
                  return co.getTime() === tomorrow.getTime();
                });

                return (
                  <div key={day.toISOString()} className={cn("border-l border-border/30 min-h-[48px] sm:min-h-[60px] relative", isToday(day) && "bg-primary/5")}>

                    {/* CHECKOUT half-bar: left half of cell */}
                    {isCheckOut && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <div className="absolute inset-y-2 sm:inset-y-3 left-0 flex items-center justify-end cursor-default" style={{
                          width: '50%',
                          backgroundColor: color.bg,
                          borderTop: `2px solid ${color.border}`,
                          borderBottom: `2px solid ${color.border}`,
                          borderRight: `3px solid ${color.text}`,
                          borderTopRightRadius: '8px',
                          borderBottomRightRadius: '8px',
                        }}>
                          <div className="flex items-center justify-center bg-rose-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 mr-0.5 sm:mr-1 shadow-sm z-10">
                            <ArrowLeftFromLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          </div>
                        </div>
                      </TooltipTrigger><TooltipContent className="bg-rose-50 border-rose-200">
                        <p className="font-semibold text-rose-700 flex items-center gap-1.5">
                          <ArrowLeftFromLine className="h-3.5 w-3.5" />Salida — {format(day, 'd MMM', { locale: es })}
                        </p>
                      </TooltipContent></Tooltip></TooltipProvider>
                    )}

                    {/* STAY bar */}
                    {isStayDay && (
                      <TooltipProvider><Tooltip><TooltipTrigger asChild>
                        <div className="absolute inset-y-2 sm:inset-y-3 flex items-center cursor-default" style={{
                          // If also checkout day (back-to-back), start from 50%
                          left: isCheckOut ? '50%' : '0',
                          // If tomorrow is checkout, extend only to edge (checkout half-bar on next cell)
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
                            <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 ml-0.5 sm:ml-1 shadow-sm z-10">
                              <ArrowRightToLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                            </div>
                          )}
                        </div>
                      </TooltipTrigger><TooltipContent>
                        <div className="space-y-1">{stayReservations.map(r => (
                          <div key={r.id} className="text-xs">
                            <p className="font-medium">{r.property?.nombre}</p>
                            <p className="text-muted-foreground">{format(new Date(r.checkInDate), 'd MMM', { locale: es })} → {format(new Date(r.checkOutDate), 'd MMM', { locale: es })}</p>
                          </div>
                        ))}</div>
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
