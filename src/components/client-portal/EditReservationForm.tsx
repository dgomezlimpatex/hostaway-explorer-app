
import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, Users, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { ClientReservation } from '@/types/clientPortal';
import { useUpdateReservation } from '@/hooks/useClientPortal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Property {
  id: string;
  nombre: string;
  codigo: string;
}

interface EditReservationFormProps {
  reservation: ClientReservation;
  properties: Property[];
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const EditReservationForm = ({
  reservation,
  properties,
  clientId,
  onSuccess,
  onCancel,
}: EditReservationFormProps) => {
  const [propertyId, setPropertyId] = useState(reservation.propertyId);
  const [checkInDate, setCheckInDate] = useState<Date>(new Date(reservation.checkInDate));
  const [checkOutDate, setCheckOutDate] = useState<Date>(new Date(reservation.checkOutDate));
  const [guestCount, setGuestCount] = useState<number | undefined>(reservation.guestCount || undefined);
  const [specialRequests, setSpecialRequests] = useState(reservation.specialRequests || '');
  
  const { toast } = useToast();
  const updateMutation = useUpdateReservation();

  const handleSubmit = async () => {
    try {
      await updateMutation.mutateAsync({
        reservationId: reservation.id,
        clientId,
        updates: {
          propertyId,
          checkInDate: format(checkInDate, 'yyyy-MM-dd'),
          checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
          guestCount,
          specialRequests,
        },
      });
      toast({
        title: 'Reserva actualizada',
        description: 'Los cambios se han guardado correctamente.',
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la reserva.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Property */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Propiedad</label>
        <Select value={propertyId} onValueChange={setPropertyId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {properties.map(prop => (
              <SelectItem key={prop.id} value={prop.id}>
                {prop.codigo || prop.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Entrada</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(checkInDate, 'dd/MM/yy', { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkInDate}
                onSelect={(date) => {
                  if (date) {
                    setCheckInDate(date);
                    if (date >= checkOutDate) {
                      setCheckOutDate(addDays(date, 1));
                    }
                  }
                }}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Salida</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(checkOutDate, 'dd/MM/yy', { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkOutDate}
                onSelect={(date) => date && setCheckOutDate(date)}
                disabled={(date) => date <= checkInDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Guest count */}
      <div>
        <label className="text-sm font-medium mb-1.5 flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          Huéspedes (opcional)
        </label>
        <Input
          type="number"
          min={1}
          placeholder="Número de huéspedes"
          value={guestCount || ''}
          onChange={(e) => setGuestCount(e.target.value ? parseInt(e.target.value) : undefined)}
        />
      </div>

      {/* Special requests */}
      <div>
        <label className="text-sm font-medium mb-1.5 flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          Peticiones especiales (opcional)
        </label>
        <Textarea
          placeholder="Llaves en portería, hora de llegada..."
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Guardar cambios'
          )}
        </Button>
      </DialogFooter>
    </div>
  );
};
