
import { useState, useCallback } from 'react';
import { format, addDays, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Trash2, Loader2, CalendarIcon, Users, MessageSquare, Home, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useCreateReservations } from '@/hooks/useClientPortal';
import { CreateReservationData } from '@/types/clientPortal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Property {
  id: string;
  nombre: string;
  codigo: string;
  direccion: string;
}

interface ReservationRow {
  id: string;
  propertyId: string;
  checkInDate: Date | undefined;
  checkOutDate: Date | undefined;
  guestCount: number | undefined;
  specialRequests: string;
  checkOutOpen: boolean;
}

interface QuickAddReservationsProps {
  clientId: string;
  properties: Property[];
  isLoading: boolean;
  onSuccess: () => void;
}

const createEmptyRow = (): ReservationRow => ({
  id: crypto.randomUUID(),
  propertyId: '',
  checkInDate: undefined,
  checkOutDate: undefined,
  guestCount: undefined,
  specialRequests: '',
  checkOutOpen: false,
});

export const QuickAddReservations = ({
  clientId,
  properties,
  isLoading,
  onSuccess,
}: QuickAddReservationsProps) => {
  const [rows, setRows] = useState<ReservationRow[]>([createEmptyRow()]);
  const { toast } = useToast();
  const createMutation = useCreateReservations();

  const updateRow = useCallback((id: string, updates: Partial<ReservationRow>) => {
    setRows(prev => prev.map(row =>
      row.id === id ? { ...row, ...updates } : row
    ));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows(prev => {
      if (prev.length === 1) return [createEmptyRow()];
      return prev.filter(row => row.id !== id);
    });
  }, []);

  const handleDateSelect = useCallback((rowId: string, date: Date | undefined, type: 'checkIn' | 'checkOut') => {
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      if (type === 'checkIn') {
        const checkOutDate = row.checkOutDate || (date ? addDays(date, 1) : undefined);
        return { ...row, checkInDate: date, checkOutDate, checkOutOpen: true };
      } else {
        return { ...row, checkOutDate: date, checkOutOpen: false };
      }
    }));
  }, []);

  const validRows = rows.filter(row =>
    row.propertyId && row.checkInDate && row.checkOutDate
  );

  const handleSubmit = async () => {
    if (validRows.length === 0) {
      toast({
        title: 'Sin reservas',
        description: 'Añade al menos una reserva con propiedad y fechas.',
        variant: 'destructive',
      });
      return;
    }

    const reservations: CreateReservationData[] = validRows.map(row => ({
      propertyId: row.propertyId,
      checkInDate: format(row.checkInDate!, 'yyyy-MM-dd'),
      checkOutDate: format(row.checkOutDate!, 'yyyy-MM-dd'),
      guestCount: row.guestCount || null,
      specialRequests: row.specialRequests || null,
    }));

    try {
      await createMutation.mutateAsync({ clientId, reservations });
      toast({
        title: '¡Reservas creadas!',
        description: `Se han añadido ${reservations.length} reserva${reservations.length > 1 ? 's' : ''}.`,
      });
      setRows([createEmptyRow()]);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron crear las reservas. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground text-sm">Cargando propiedades...</p>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Home className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground mt-4">No tienes propiedades asignadas.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Contacta con tu supervisor para añadir propiedades.
        </p>
      </div>
    );
  }

  const isRowComplete = (row: ReservationRow) =>
    row.propertyId && row.checkInDate && row.checkOutDate;

  const getNights = (row: ReservationRow) => {
    if (row.checkInDate && row.checkOutDate) {
      return differenceInCalendarDays(row.checkOutDate, row.checkInDate);
    }
    return 0;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-1">
        <h2 className="text-lg font-semibold">Nueva reserva</h2>
        <p className="text-sm text-muted-foreground">
          Las limpiezas se crearán automáticamente.
        </p>
      </div>

      {/* Reservation cards */}
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className={cn(
              "rounded-xl border-2 bg-card transition-all shadow-sm",
              isRowComplete(row) ? "border-primary/30 bg-primary/[0.02]" : "border-muted"
            )}
          >
            {/* Card header with number and delete */}
            <div className="flex items-center justify-between px-4 pt-3 pb-0">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {index + 1}
                </span>
                <span className="text-sm font-medium">
                  Reserva {index + 1}
                </span>
              </div>
              {rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.id)}
                  className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Property */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Propiedad
                </label>
                <Select
                  value={row.propertyId}
                  onValueChange={(value) => updateRow(row.id, { propertyId: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecciona propiedad" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(prop => (
                      <SelectItem key={prop.id} value={prop.id}>
                        <span className="font-medium">{prop.codigo}</span>
                        {prop.codigo !== prop.nombre && (
                          <span className="text-muted-foreground ml-1.5">— {prop.nombre}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates stacked */}
              <div className="space-y-3">
                {/* Check-in */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Entrada
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-11 justify-start text-left font-normal",
                          !row.checkInDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {row.checkInDate ? (
                          format(row.checkInDate, 'dd MMM yyyy', { locale: es })
                        ) : (
                          <span>Selecciona fecha de entrada</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <Calendar
                        mode="single"
                        selected={row.checkInDate}
                        onSelect={(date) => handleDateSelect(row.id, date, 'checkIn')}
                        defaultMonth={row.checkInDate || undefined}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Check-out */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Salida
                  </label>
                  <Popover
                    open={row.checkOutOpen}
                    onOpenChange={(open) => updateRow(row.id, { checkOutOpen: open })}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-11 justify-start text-left font-normal",
                          !row.checkOutDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {row.checkOutDate ? (
                          format(row.checkOutDate, 'dd MMM yyyy', { locale: es })
                        ) : (
                          <span>Selecciona fecha de salida</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <Calendar
                        mode="single"
                        selected={row.checkOutDate}
                        onSelect={(date) => handleDateSelect(row.id, date, 'checkOut')}
                        defaultMonth={row.checkOutDate || row.checkInDate || undefined}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today || (row.checkInDate ? date <= row.checkInDate : false);
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Nights badge */}
              {getNights(row) > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="h-3 w-3" />
                  <span>{getNights(row)} noche{getNights(row) > 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Optional fields - always visible */}
              <div className="space-y-3 pt-2 border-t border-dashed">
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Users className="h-3 w-3" />
                    Huéspedes
                    <span className="text-muted-foreground/50 font-normal">(opcional)</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Número de huéspedes"
                    className="h-10"
                    value={row.guestCount || ''}
                    onChange={(e) => updateRow(row.id, {
                      guestCount: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="h-3 w-3" />
                    Peticiones especiales
                  </label>
                  <Textarea
                    placeholder="Llaves en portería, hora de llegada..."
                    value={row.specialRequests}
                    onChange={(e) => updateRow(row.id, { specialRequests: e.target.value })}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add another reservation */}
      {rows.every(row => isRowComplete(row)) && (
        <Button
          variant="outline"
          className="w-full h-11 border-dashed"
          onClick={() => setRows(prev => [...prev, createEmptyRow()])}
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir otra reserva
        </Button>
      )}

      {/* Submit */}
      {validRows.length > 0 && (
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="w-full h-12 text-base font-medium"
          size="lg"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Guardando...
            </>
          ) : (
            <>
              Guardar {validRows.length} reserva{validRows.length > 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
