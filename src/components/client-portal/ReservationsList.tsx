
import { useState } from 'react';
import { format, isPast, isToday, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar, MapPin, Users, Edit2, Trash2, Loader2, MessageSquare,
  ChevronRight, Home, Lock, RefreshCw,
} from 'lucide-react';
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

  // Sort bookings: upcoming first, then past
  const sortedBookings = [...bookings].sort((a, b) => {
    const dateA = new Date(a.cleaningDate);
    const dateB = new Date(b.cleaningDate);
    const now = new Date();
    
    const aIsFuture = dateA >= now;
    const bIsFuture = dateB >= now;
    
    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;
    
    return aIsFuture ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
  });

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
        <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Mis Reservas</CardTitle>
              <CardDescription className="mt-1">
                {bookings.length} reserva{bookings.length !== 1 ? 's' : ''} en total
              </CardDescription>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
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
          <div className="divide-y divide-border/50">
            {sortedBookings.map((booking) => {
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
                    isPastBooking 
                      ? 'bg-muted/30 hover:bg-muted/50' 
                      : 'hover:bg-accent/50'
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
                  
                  <div className="flex items-center gap-4 p-4 pl-5">
                    <div className={`hidden sm:flex w-12 h-12 rounded-xl items-center justify-center shrink-0 ${
                      isPastBooking 
                        ? 'bg-muted text-muted-foreground' 
                        : isExternal
                          ? 'bg-muted/60 text-muted-foreground'
                          : 'bg-primary/10 text-primary'
                    }`}>
                      {isExternal ? <RefreshCw className="h-5 w-5" /> : <Home className="h-5 w-5" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className={`font-semibold text-base ${
                          isPastBooking ? 'text-muted-foreground' : 'text-foreground'
                        }`}>
                          {booking.property?.codigo || booking.property?.nombre || 'Propiedad'}
                        </h3>

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
                          <Badge variant="secondary" className="opacity-70">
                            Completada
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 flex-wrap text-sm">
                        <div className={`flex items-center gap-1.5 ${
                          isPastBooking ? 'text-muted-foreground/70' : 'text-muted-foreground'
                        }`}>
                          <Calendar className="h-3.5 w-3.5" />
                          {isExternal ? (
                            <span className="font-medium">
                              Limpieza: {format(cleaningDate, "d MMM yyyy", { locale: es })}
                            </span>
                          ) : (
                            <>
                              <span className="font-medium">
                                {format(checkInDate, 'd MMM', { locale: es })}
                              </span>
                              <ChevronRight className="h-3 w-3" />
                              <span className="font-medium">
                                {format(checkOutDate, 'd MMM yyyy', { locale: es })}
                              </span>
                              {nights !== null && (
                                <span className="text-muted-foreground/60 ml-1">
                                  ({nights} noche{nights > 1 ? 's' : ''})
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 flex-wrap mt-2">
                        {booking.property?.direccion && (
                          <div className={`flex items-center gap-1.5 text-xs ${
                            isPastBooking ? 'text-muted-foreground/60' : 'text-muted-foreground'
                          }`}>
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{booking.property.direccion}</span>
                          </div>
                        )}
                        {booking.guestCount && (
                          <div className={`flex items-center gap-1.5 text-xs ${
                            isPastBooking ? 'text-muted-foreground/60' : 'text-muted-foreground'
                          }`}>
                            <Users className="h-3 w-3" />
                            <span>{booking.guestCount} huéspedes</span>
                          </div>
                        )}
                        {booking.specialRequests && (
                          <div className={`flex items-center gap-1.5 text-xs ${
                            isPastBooking ? 'text-muted-foreground/60' : 'text-amber-600'
                          }`}>
                            <MessageSquare className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{booking.specialRequests}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions: only for editable (manual) bookings still active */}
                    {booking.isEditable && isStillActive && booking.status === 'active' && (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={() => setEditingBooking(booking)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => setCancellingBooking(booking)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <ChevronRight className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
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
