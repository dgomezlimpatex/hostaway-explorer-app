
import { useState } from 'react';
import { format, isPast, isToday, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, MapPin, Users, Edit2, Trash2, Loader2, MessageSquare, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

  if (reservations.length === 0) {
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

  // Calculate days until check-in
  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Get nights count
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
                {reservations.length} reserva{reservations.length !== 1 ? 's' : ''} en total
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
            {sortedReservations.map((reservation, index) => {
              const checkInDate = new Date(reservation.checkInDate);
              const checkOutDate = new Date(reservation.checkOutDate);
              const isUpcoming = isFuture(checkInDate) || isToday(checkInDate);
              const isPastReservation = isPast(checkOutDate);
              const daysUntil = getDaysUntil(checkInDate);
              const nights = getNightsCount(checkInDate, checkOutDate);
              
              return (
                <div
                  key={reservation.id}
                  className={`group relative transition-all duration-200 ${
                    isPastReservation 
                      ? 'bg-muted/30' 
                      : 'hover:bg-accent/50'
                  }`}
                >
                  {/* Left accent bar */}
                  {isUpcoming && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      isToday(checkInDate) 
                        ? 'bg-green-500' 
                        : daysUntil <= 3 
                          ? 'bg-amber-500' 
                          : 'bg-primary'
                    }`} />
                  )}
                  
                  <div className="flex items-center gap-4 p-4 pl-5">
                    {/* Property Icon */}
                    <div className={`hidden sm:flex w-12 h-12 rounded-xl items-center justify-center shrink-0 ${
                      isPastReservation 
                        ? 'bg-muted text-muted-foreground' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      <Home className="h-5 w-5" />
                    </div>
                    
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className={`font-semibold text-base ${
                          isPastReservation ? 'text-muted-foreground' : 'text-foreground'
                        }`}>
                          {reservation.property?.codigo || reservation.property?.nombre || 'Propiedad'}
                        </h3>
                        
                        {isToday(checkInDate) && (
                          <Badge className="bg-green-500/15 text-green-700 border-green-200 hover:bg-green-500/20">
                            Hoy
                          </Badge>
                        )}
                        {!isPastReservation && !isToday(checkInDate) && daysUntil <= 3 && daysUntil > 0 && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">
                            En {daysUntil} día{daysUntil > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {isPastReservation && (
                          <Badge variant="secondary" className="opacity-70">
                            Completada
                          </Badge>
                        )}
                      </div>
                      
                      {/* Date info */}
                      <div className="flex items-center gap-4 flex-wrap text-sm">
                        <div className={`flex items-center gap-1.5 ${
                          isPastReservation ? 'text-muted-foreground/70' : 'text-muted-foreground'
                        }`}>
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="font-medium">
                            {format(checkInDate, 'd MMM', { locale: es })}
                          </span>
                          <ChevronRight className="h-3 w-3" />
                          <span className="font-medium">
                            {format(checkOutDate, 'd MMM yyyy', { locale: es })}
                          </span>
                          <span className="text-muted-foreground/60 ml-1">
                            ({nights} noche{nights > 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>
                      
                      {/* Additional info row */}
                      <div className="flex items-center gap-4 flex-wrap mt-2">
                        {reservation.property?.direccion && (
                          <div className={`flex items-center gap-1.5 text-xs ${
                            isPastReservation ? 'text-muted-foreground/60' : 'text-muted-foreground'
                          }`}>
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">{reservation.property.direccion}</span>
                          </div>
                        )}
                        {reservation.guestCount && (
                          <div className={`flex items-center gap-1.5 text-xs ${
                            isPastReservation ? 'text-muted-foreground/60' : 'text-muted-foreground'
                          }`}>
                            <Users className="h-3 w-3" />
                            <span>{reservation.guestCount} huéspedes</span>
                          </div>
                        )}
                        {reservation.specialRequests && (
                          <div className={`flex items-center gap-1.5 text-xs ${
                            isPastReservation ? 'text-muted-foreground/60' : 'text-amber-600'
                          }`}>
                            <MessageSquare className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{reservation.specialRequests}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {isUpcoming && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={() => setEditingReservation(reservation)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => setCancellingReservation(reservation)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Chevron for past reservations */}
                    {isPastReservation && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
