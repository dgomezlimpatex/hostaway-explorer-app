
import { useState } from 'react';
import { format, isPast, isToday, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Edit2, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ClientReservation } from '@/types/clientPortal';
import { useCancelReservation, useUpdateReservation } from '@/hooks/useClientPortal';
import { useToast } from '@/hooks/use-toast';
import { EditReservationForm } from './EditReservationForm';

interface Property {
  id: string;
  nombre: string;
  codigo: string;
  direccion: string;
}

interface ReservationsListProps {
  clientId: string;
  reservations: ClientReservation[];
  properties: Property[];
  isLoading: boolean;
}

export const ReservationsList = ({
  clientId,
  reservations,
  properties,
  isLoading,
}: ReservationsListProps) => {
  const [editingReservation, setEditingReservation] = useState<ClientReservation | null>(null);
  const [cancellingReservation, setCancellingReservation] = useState<ClientReservation | null>(null);
  const { toast } = useToast();
  
  const cancelMutation = useCancelReservation();
  const updateMutation = useUpdateReservation();

  const handleCancel = async () => {
    if (!cancellingReservation) return;
    
    try {
      await cancelMutation.mutateAsync({
        reservationId: cancellingReservation.id,
        clientId,
      });
      toast({
        title: 'Reserva cancelada',
        description: 'La reserva y su limpieza asociada han sido eliminadas.',
      });
      setCancellingReservation(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la reserva.',
        variant: 'destructive',
      });
    }
  };

  // Sort reservations: upcoming first, then past
  const sortedReservations = [...reservations].sort((a, b) => {
    const dateA = new Date(a.checkInDate);
    const dateB = new Date(b.checkInDate);
    const now = new Date();
    
    // Future/today before past
    const aIsFuture = dateA >= now;
    const bIsFuture = dateB >= now;
    
    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;
    
    // Within same category, sort by date
    return aIsFuture ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Cargando reservas...</p>
        </CardContent>
      </Card>
    );
  }

  if (reservations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <p className="mt-4 text-muted-foreground">No tienes reservas.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Ve a la pestaña "Añadir" para crear nuevas reservas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Mis Reservas</CardTitle>
          <CardDescription>
            {reservations.length} reserva{reservations.length !== 1 ? 's' : ''} en total
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedReservations.map(reservation => {
            const checkInDate = new Date(reservation.checkInDate);
            const checkOutDate = new Date(reservation.checkOutDate);
            const isUpcoming = isFuture(checkInDate) || isToday(checkInDate);
            const isPastReservation = isPast(checkOutDate);
            
            return (
              <div
                key={reservation.id}
                className={`border rounded-lg p-4 ${
                  isPastReservation ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Property name */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {reservation.property?.codigo || reservation.property?.nombre || 'Propiedad'}
                      </span>
                      {isToday(checkInDate) && (
                        <Badge variant="default" className="text-xs">Hoy</Badge>
                      )}
                      {isPastReservation && (
                        <Badge variant="secondary" className="text-xs">Pasada</Badge>
                      )}
                    </div>
                    
                    {/* Dates */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {format(checkInDate, 'dd MMM', { locale: es })} → {format(checkOutDate, 'dd MMM yyyy', { locale: es })}
                      </span>
                    </div>
                    
                    {/* Address */}
                    {reservation.property?.direccion && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{reservation.property.direccion}</span>
                      </div>
                    )}
                    
                    {/* Guest count & notes */}
                    <div className="flex flex-wrap gap-3">
                      {reservation.guestCount && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span>{reservation.guestCount} huéspedes</span>
                        </div>
                      )}
                      {reservation.specialRequests && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[200px]">{reservation.specialRequests}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions - only for upcoming */}
                  {isUpcoming && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingReservation(reservation)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setCancellingReservation(reservation)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editingReservation} onOpenChange={() => setEditingReservation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Reserva</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la reserva. La limpieza se actualizará automáticamente.
            </DialogDescription>
          </DialogHeader>
          {editingReservation && (
            <EditReservationForm
              reservation={editingReservation}
              properties={properties}
              clientId={clientId}
              onSuccess={() => setEditingReservation(null)}
              onCancel={() => setEditingReservation(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancellingReservation} onOpenChange={() => setCancellingReservation(null)}>
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
