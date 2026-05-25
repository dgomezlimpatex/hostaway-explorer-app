import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2, CheckCircle2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  useActiveExtraordinaryRequestTypes,
  useCreateExtraordinaryRequest,
  useUpdateExtraordinaryRequest,
} from '@/hooks/useExtraordinaryRequests';
import type { ClientExtraordinaryRequest } from '@/types/extraordinaryRequest';

interface Property { id: string; nombre: string; codigo: string; direccion: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  properties: Property[];
  editRequest?: ClientExtraordinaryRequest | null;
}

export const CreateExtraordinaryRequestModal = ({ open, onOpenChange, clientId, properties, editRequest }: Props) => {
  const isEdit = !!editRequest;
  const { data: types = [], isLoading: loadingTypes } = useActiveExtraordinaryRequestTypes();
  const create = useCreateExtraordinaryRequest();
  const update = useUpdateExtraordinaryRequest();

  const [propertyId, setPropertyId] = useState<string>('');
  const [typeId, setTypeId] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const selectedType = useMemo(() => types.find(t => t.id === typeId), [types, typeId]);

  // Hydrate state when editing
  useEffect(() => {
    if (!open) return;
    if (editRequest) {
      setPropertyId(editRequest.propertyId);
      setTypeId(editRequest.requestTypeId ?? '');
      setDate(new Date(editRequest.serviceDate + 'T00:00:00'));
      setTime(editRequest.serviceTime ? editRequest.serviceTime.slice(0, 5) : '');
      setGuestName(editRequest.guestName ?? '');
      setNotes(editRequest.notes ?? '');
      setAccepted(true);
    } else {
      setPropertyId(''); setTypeId(''); setDate(undefined); setTime('');
      setGuestName(''); setNotes(''); setAccepted(false);
    }
  }, [open, editRequest]);

  const reset = () => {
    setPropertyId(''); setTypeId(''); setDate(undefined); setTime('');
    setGuestName(''); setNotes(''); setAccepted(false);
  };

  const isPending = create.isPending || update.isPending;
  const canSubmit = propertyId && typeId && date && (!selectedType?.requiresTime || time) && accepted && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit || !date || !selectedType) return;
    try {
      if (isEdit && editRequest) {
        await update.mutateAsync({
          requestId: editRequest.id,
          clientId,
          serviceDate: format(date, 'yyyy-MM-dd'),
          serviceTime: selectedType.requiresTime ? (time || null) : (time || null),
          guestName: guestName || null,
          notes: notes || null,
        });
      } else {
        await create.mutateAsync({
          clientId,
          propertyId,
          requestTypeId: typeId,
          serviceDate: format(date, 'yyyy-MM-dd'),
          serviceTime: selectedType.requiresTime ? (time || null) : (time || null),
          guestName: guestName || null,
          notes: notes || null,
        });
      }
      reset();
      onOpenChange(false);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar solicitud extraordinaria' : 'Nueva solicitud extraordinaria'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza la fecha, hora o detalles de tu solicitud. El tipo de servicio y la propiedad no se pueden cambiar.'
              : 'Solicita un servicio especial para tu huésped. Se añadirá automáticamente a nuestro calendario.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Propiedad */}
          <div>
            <Label className="text-sm">Propiedad *</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecciona una propiedad" />
              </SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre} ({p.codigo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de servicio */}
          <div>
            <Label className="text-sm mb-2 block">Tipo de servicio *</Label>
            {loadingTypes ? (
              <p className="text-xs text-muted-foreground">Cargando…</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {types.map(t => {
                  const selected = typeId === t.id;
                  return (
                    <Card
                      key={t.id}
                      onClick={() => setTypeId(t.id)}
                      className={cn(
                        'p-3 cursor-pointer transition-all hover:border-primary/50',
                        selected && 'border-primary ring-2 ring-primary/20 bg-primary/5'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-lg">{t.icon ?? '✨'}</div>
                          <div className="font-medium text-sm truncate">{t.label}</div>
                        </div>
                        {selected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                      <div className="mt-2 text-xs font-bold text-emerald-600">
                        {t.defaultCost > 0 ? `${t.defaultCost.toFixed(2)} €` : 'Gratis'}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Fecha *</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start mt-1.5 font-normal', !date && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "d MMM yyyy", { locale: es }) : 'Selecciona'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { setDate(d); setDateOpen(false); }}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-sm">
                Hora {selectedType?.requiresTime ? '*' : '(opcional)'}
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Huésped + notas */}
          <div>
            <Label className="text-sm">Nombre del huésped (opcional)</Label>
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm">Notas adicionales (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1.5"
              rows={2}
              placeholder="Detalles del servicio…"
            />
          </div>

          {/* Resumen + aceptación */}
          {selectedType && (
            <Card className="p-3 bg-emerald-50 border-emerald-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-900">Coste del servicio:</span>
                <span className="font-bold text-emerald-700 text-base">
                  {selectedType.defaultCost.toFixed(2)} €
                </span>
              </div>
              <label className="flex items-start gap-2 mt-3 cursor-pointer">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                <span className="text-xs text-emerald-900">
                  Acepto el cargo de <strong>{selectedType.defaultCost.toFixed(2)} €</strong> por este servicio.
                </span>
              </label>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
