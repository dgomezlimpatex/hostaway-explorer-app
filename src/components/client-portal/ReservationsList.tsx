
import { useState, useMemo } from 'react';
import { format, isPast, isToday, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar, MapPin, Users, Edit2, Trash2, Loader2, MessageSquare,
  ChevronRight, Home, Lock, RefreshCw, Building2,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ClientReservation, PortalBooking } from '@/types/clientPortal';
import { useCancelReservation, useUpdateReservation } from '@/hooks/useClientPortal';
import { useToast } from '@/hooks/use-toast';
import { EditReservationForm } from './EditReservationForm';
import { ReservationDetailModal } from './ReservationDetailModal';

interface Property {
  id: string;
  nombre: string;
  codigo: string;
  direccion: string;
}

interface ReservationsListProps {
  clientId: string;
  clientName: string;
  bookings: PortalBooking[];
  properties: Property[];
  isLoading: boolean;
}

// Convert a PortalBooking back to a ClientReservation for the EditReservationForm (manual only)
const bookingToReservation = (b: PortalBooking): ClientReservation => ({
  id: b.reservationId!,
  clientId: '',
  propertyId: b.property?.id ?? '',
  checkInDate: b.checkInDate ?? b.cleaningDate,
  checkOutDate: b.checkOutDate ?? b.cleaningDate,
  guestCount: b.guestCount,
  specialRequests: b.specialRequests,
  taskId: b.taskId,
  status: b.status as 'active' | 'cancelled' | 'completed',
  createdAt: '',
  updatedAt: '',
  property: b.property ? {
    id: b.property.id,
    nombre: b.property.nombre,
    codigo: b.property.codigo,
    direccion: b.property.direccion,
    checkOutPredeterminado: b.property.checkOutPredeterminado ?? '11:00',
  } : undefined,
});

export const ReservationsList = ({
  clientId,
  clientName,
  bookings,
  properties,
  isLoading,
}: ReservationsListProps) => {
  const [editingBooking, setEditingBooking] = useState<PortalBooking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<PortalBooking | null>(null);
  const [detailBooking, setDetailBooking] = useState<PortalBooking | null>(null);
  const { toast } = useToast();
  
  const cancelMutation = useCancelReservation();

  const handleCancel = async () => {
    if (!cancellingBooking?.reservationId) return;
    
    try {
      await cancelMutation.mutateAsync({
        reservationId: cancellingBooking.reservationId,
        clientId,
        clientName,
      });
      toast({
        title: 'Reserva cancelada',
        description: 'La reserva y su limpieza asociada han sido eliminadas.',
      });
      setCancellingBooking(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la reserva.',
        variant: 'destructive',
      });
    }
  };

  // Group bookings by property; within each group sort by cleaningDate DESC (today → past → future at bottom)
  const groupedByProperty = useMemo(() => {
    const groups = new Map<string, {
      propertyId: string;
      propertyName: string;
      propertyCode: string;
      propertyAddress: string;
      bookings: PortalBooking[];
    }>();

    for (const b of bookings) {
      const key = b.property?.id || b.property?.codigo || b.property?.nombre || '__sin_propiedad__';
      if (!groups.has(key)) {
        groups.set(key, {
          propertyId: b.property?.id ?? '',
          propertyName: b.property?.nombre ?? 'Sin propiedad',
          propertyCode: b.property?.codigo ?? '',
          propertyAddress: b.property?.direccion ?? '',
          bookings: [],
        });
      }
      groups.get(key)!.bookings.push(b);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sort each group: today first, then past descending, then future ascending at the bottom
    for (const g of groups.values()) {
      g.bookings.sort((a, b) => {
        const dA = new Date(a.cleaningDate);
        const dB = new Date(b.cleaningDate);
        const aFuture = dA > today;
        const bFuture = dB > today;
        if (aFuture && !bFuture) return 1;
        if (!aFuture && bFuture) return -1;
        // Both past/today OR both future → newest first
        return dB.getTime() - dA.getTime();
      });
    }

    // Sort groups alphabetically by code/name
    return Array.from(groups.values()).sort((a, b) =>
      (a.propertyCode || a.propertyName).localeCompare(b.propertyCode || b.propertyName, 'es', { sensitivity: 'base' })
    );
  }, [bookings]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-muted/30">
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground font-medium">Cargando reservas...</p>
        </CardContent>
      </Card>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-muted/30">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Sin reservas</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Aún no tienes reservas registradas. Ve a la pestaña "Añadir" para crear tu primera reserva.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getNightsCount = (checkIn: Date, checkOut: Date) => {
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <>
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl">Mis Reservas</CardTitle>
              <CardDescription className="mt-1 text-xs sm:text-sm">
                {bookings.length} reserva{bookings.length !== 1 ? 's' : ''} en total
              </CardDescription>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Próximas</span>
              </div>
              <div className="flex items-center gap-1.5 ml-3">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                <span>Pasadas</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Accordion type="multiple" className="divide-y divide-border/50">
            {groupedByProperty.map((group) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const upcomingCount = group.bookings.filter(b => new Date(b.cleaningDate) >= today).length;
              const pastCount = group.bookings.length - upcomingCount;
              const groupKey = group.propertyId || group.propertyCode || group.propertyName;

              return (
                <AccordionItem key={groupKey} value={groupKey} className="border-0">
                  <AccordionTrigger className="px-3 sm:px-4 py-3 hover:bg-accent/30 hover:no-underline gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 text-left">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm sm:text-base text-foreground truncate">
                          {group.propertyCode ? `${group.propertyCode} · ${group.propertyName}` : group.propertyName}
                        </div>
                        <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{group.bookings.length} tarea{group.bookings.length !== 1 ? 's' : ''}</span>
                          {upcomingCount > 0 && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-green-500/10 text-green-700 border-green-200">
                              {upcomingCount} próxima{upcomingCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {pastCount > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] opacity-70">
                              {pastCount} pasada{pastCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <div className="divide-y divide-border/40 bg-muted/10">
                      {group.bookings.map((booking) => {
                        const cleaningDate = new Date(booking.cleaningDate);
                        const checkInDate = booking.checkInDate ? new Date(booking.checkInDate) : cleaningDate;
                        const checkOutDate = booking.checkOutDate ? new Date(booking.checkOutDate) : cleaningDate;
                        const isExternal = booking.source === 'external';
                        const isUpcoming = isFuture(cleaningDate) || isToday(cleaningDate);
                        const isStillActive = !isPast(checkOutDate);
                        const isPastBooking = isPast(checkOutDate);
                        const daysUntil = getDaysUntil(cleaningDate);
                        const nights = !isExternal ? getNightsCount(checkInDate, checkOutDate) : null;

                        return (
                          <div
                            key={booking.id}
                            onClick={() => setDetailBooking(booking)}
                            className={`group relative transition-all duration-200 cursor-pointer ${
                              isPastBooking ? 'hover:bg-muted/50' : 'hover:bg-accent/50'
                            }`}
                          >
                            {isUpcoming && (
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                isToday(cleaningDate)
                                  ? 'bg-green-500'
                                  : daysUntil <= 3
                                    ? 'bg-amber-500'
                                    : 'bg-primary'
                              }`} />
                            )}

                            <div className="flex items-center gap-3 p-3 pl-5">
                              <div className={`hidden sm:flex w-10 h-10 rounded-lg items-center justify-center shrink-0 ${
                                isPastBooking
                                  ? 'bg-muted text-muted-foreground'
                                  : isExternal
                                    ? 'bg-muted/60 text-muted-foreground'
                                    : 'bg-primary/10 text-primary'
                              }`}>
                                {isExternal ? <RefreshCw className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <div className={`flex items-center gap-1.5 text-sm font-medium ${
                                    isPastBooking ? 'text-muted-foreground' : 'text-foreground'
                                  }`}>
                                    <Calendar className="h-3.5 w-3.5" />
                                    {isExternal ? (
                                      <span>{format(cleaningDate, "EEE d MMM yyyy", { locale: es })}</span>
                                    ) : (
                                      <>
                                        <span>{format(checkInDate, 'd MMM', { locale: es })}</span>
                                        <ChevronRight className="h-3 w-3" />
                                        <span>{format(checkOutDate, 'd MMM yyyy', { locale: es })}</span>
                                        {nights !== null && (
                                          <span className="text-muted-foreground/60 ml-1 text-xs">
                                            ({nights} noche{nights > 1 ? 's' : ''})
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  {isExternal && (
                                    <Badge variant="outline" className="text-[10px] gap-1 bg-muted/50">
                                      <Lock className="h-2.5 w-2.5" />
                                      Sincronizada
                                    </Badge>
                                  )}
                                  {isToday(cleaningDate) && (
                                    <Badge className="bg-green-500/15 text-green-700 border-green-200 hover:bg-green-500/20">
                                      Hoy
                                    </Badge>
                                  )}
                                  {!isPastBooking && !isToday(cleaningDate) && daysUntil <= 3 && daysUntil > 0 && (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">
                                      En {daysUntil} día{daysUntil > 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                  {isPastBooking && (
                                    <Badge variant="secondary" className="opacity-70 text-[10px]">
                                      Completada
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                  {booking.guestCount && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Users className="h-3 w-3" />
                                      <span>{booking.guestCount} huéspedes</span>
                                    </div>
                                  )}
                                  {booking.specialRequests && (
                                    <div className={`flex items-center gap-1.5 text-xs ${
                                      isPastBooking ? 'text-muted-foreground/60' : 'text-amber-600'
                                    }`}>
                                      <MessageSquare className="h-3 w-3" />
                                      <span className="truncate max-w-[200px]">{booking.specialRequests}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {booking.isEditable && isStillActive && booking.status === 'active' && (
                                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={() => setEditingBooking(booking)}
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setCancellingBooking(booking)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}

                              <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Detail modal (always available, for both manual and external) */}
      <ReservationDetailModal
        booking={detailBooking}
        clientId={clientId}
        open={!!detailBooking}
        onOpenChange={(open) => !open && setDetailBooking(null)}
      />

      {/* Edit dialog (manual only) */}
      <Dialog open={!!editingBooking} onOpenChange={() => setEditingBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Reserva</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la reserva. La limpieza se actualizará automáticamente.
            </DialogDescription>
          </DialogHeader>
          {editingBooking && (
            <EditReservationForm
              reservation={bookingToReservation(editingBooking)}
              properties={properties}
              clientId={clientId}
              clientName={clientName}
              onSuccess={() => setEditingBooking(null)}
              onCancel={() => setEditingBooking(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancellingBooking} onOpenChange={() => setCancellingBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la reserva y la limpieza asociada. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Sí, cancelar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
