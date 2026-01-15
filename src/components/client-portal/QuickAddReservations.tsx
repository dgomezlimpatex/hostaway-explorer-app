
import { useState, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Trash2, Loader2, Calendar as CalendarIcon, Users, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  isExpanded: boolean;
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
  isExpanded: false,
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
    setRows(prev => {
      const newRows = prev.map(row => 
        row.id === id ? { ...row, ...updates } : row
      );
      
      // Auto-add new row if last row has property and dates
      const lastRow = newRows[newRows.length - 1];
      if (lastRow.propertyId && lastRow.checkInDate && lastRow.checkOutDate) {
        return [...newRows, createEmptyRow()];
      }
      
      return newRows;
    });
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
        // If selecting check-in and no check-out, auto-set check-out to next day
        const checkOutDate = row.checkOutDate || (date ? addDays(date, 1) : undefined);
        // Auto-open check-out calendar after selecting check-in
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
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Cargando propiedades...</p>
        </CardContent>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No tienes propiedades asignadas.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Contacta con tu supervisor para añadir propiedades.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Añadir Reservas
        </CardTitle>
        <CardDescription>
          Añade varias reservas de forma rápida. Las limpiezas se crearán automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reservation rows */}
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id} className="border rounded-lg p-3 space-y-3">
              {/* Main row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                {/* Property selector */}
                <div className="sm:col-span-4">
                  <Select
                    value={row.propertyId}
                    onValueChange={(value) => updateRow(row.id, { propertyId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona propiedad" />
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

                {/* Check-in date */}
                <div className="sm:col-span-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !row.checkInDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {row.checkInDate ? (
                          format(row.checkInDate, 'dd/MM/yy', { locale: es })
                        ) : (
                          <span>Entrada</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={row.checkInDate}
                        onSelect={(date) => handleDateSelect(row.id, date, 'checkIn')}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Check-out date */}
                <div className="sm:col-span-3">
                  <Popover 
                    open={row.checkOutOpen} 
                    onOpenChange={(open) => updateRow(row.id, { checkOutOpen: open })}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !row.checkOutDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {row.checkOutDate ? (
                          format(row.checkOutDate, 'dd/MM/yy', { locale: es })
                        ) : (
                          <span>Salida</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={row.checkOutDate}
                        onSelect={(date) => handleDateSelect(row.id, date, 'checkOut')}
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

                {/* Actions */}
                <div className="sm:col-span-2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => updateRow(row.id, { isExpanded: !row.isExpanded })}
                    className="h-9 w-9"
                  >
                    <MessageSquare className={cn(
                      "h-4 w-4",
                      row.isExpanded && "text-primary"
                    )} />
                  </Button>
                  {rows.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.id)}
                      className="h-9 w-9 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded section */}
              {row.isExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                      <Users className="h-3 w-3" />
                      Huéspedes
                    </label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Número"
                      value={row.guestCount || ''}
                      onChange={(e) => updateRow(row.id, { 
                        guestCount: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                      <MessageSquare className="h-3 w-3" />
                      Peticiones especiales
                    </label>
                    <Textarea
                      placeholder="Llaves en portería, hora llegada..."
                      value={row.specialRequests}
                      onChange={(e) => updateRow(row.id, { specialRequests: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add row button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setRows(prev => [...prev, createEmptyRow()])}
        >
          <Plus className="h-4 w-4 mr-2" />
          Añadir otra reserva
        </Button>

        {/* Submit */}
        {validRows.length > 0 && (
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="w-full"
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
      </CardContent>
    </Card>
  );
};
