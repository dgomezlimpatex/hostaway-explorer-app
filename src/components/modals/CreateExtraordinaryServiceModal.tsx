import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Clock, Euro, MapPin, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useCleaners } from '@/hooks/useCleaners';
import type { ExtraordinaryTaskFormData } from '@/services/extraordinaryTaskBuilder';
import { addMinutesToTime } from '@/services/extraordinaryTaskBuilder';

interface CreateExtraordinaryServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateService: (serviceData: ExtraordinaryTaskFormData) => Promise<void>;
  currentDate?: Date;
}

const QUICK_SERVICES = [
  'Limpieza puntual',
  'Cristales',
  'Mantenimiento',
  'Revisión',
  'Recogida / entrega',
  'Desplazamiento',
];

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 h', value: 60 },
  { label: '1 h 30', value: 90 },
  { label: '2 h', value: 120 },
  { label: '3 h', value: 180 },
];

const defaultForm = (currentDate: Date): ExtraordinaryTaskFormData => ({
  serviceName: '',
  serviceAddress: '',
  serviceDate: format(currentDate, 'yyyy-MM-dd'),
  startTime: '09:00',
  durationMinutes: 60,
  cleanerId: undefined,
  cleanerName: '',
  clientName: '',
  billingAddress: '',
  email: '',
  phoneNumber: '',
  serviceCost: 0,
  paymentMethod: 'transferencia',
  needsInvoice: false,
  notes: '',
});

export const CreateExtraordinaryServiceModal = ({
  open,
  onOpenChange,
  onCreateService,
  currentDate = new Date(),
}: CreateExtraordinaryServiceModalProps) => {
  const { toast } = useToast();
  const { cleaners, isLoading } = useCleaners();
  const [formData, setFormData] = useState<ExtraordinaryTaskFormData>(() => defaultForm(currentDate));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCleaners = useMemo(
    () => cleaners.filter((cleaner) => cleaner.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [cleaners]
  );

  useEffect(() => {
    if (open) {
      setFormData(defaultForm(currentDate));
      setIsSubmitting(false);
    }
  }, [currentDate, open]);

  const updateField = <K extends keyof ExtraordinaryTaskFormData>(field: K, value: ExtraordinaryTaskFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleCleanerChange = (cleanerId: string) => {
    if (cleanerId === 'unassigned') {
      setFormData((current) => ({ ...current, cleanerId: undefined, cleanerName: '' }));
      return;
    }

    const cleaner = activeCleaners.find((item) => item.id === cleanerId);
    setFormData((current) => ({
      ...current,
      cleanerId,
      cleanerName: cleaner?.name || '',
    }));
  };

  const validate = () => {
    if (!formData.serviceName.trim()) return 'Indica qué trabajo hay que hacer.';
    if (!formData.serviceAddress.trim()) return 'Indica dónde se realizará el trabajo.';
    if (!formData.serviceDate) return 'Selecciona una fecha.';
    if (!formData.startTime) return 'Selecciona una hora de inicio.';
    if (formData.durationMinutes <= 0) return 'La duración debe ser mayor que 0.';
    if (formData.serviceCost < 0) return 'El coste no puede ser negativo.';
    if (formData.email.trim() && !formData.email.includes('@')) return 'Introduce un email válido.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const error = validate();
    if (error) {
      toast({ title: 'Revisa la tarea', description: error, variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateService(formData);
      onOpenChange(false);
    } catch (submitError) {
      console.error('Error creating extraordinary task:', submitError);
      toast({
        title: 'Error',
        description: 'No se pudo crear la tarea extraordinaria.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear tarea extraordinaria</DialogTitle>
          <DialogDescription>
            Para trabajos puntuales sin propiedad asociada. La tarea quedará en calendario y se podrá asignar como cualquier otra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Trabajo
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_SERVICES.map((service) => (
                <Button
                  key={service}
                  type="button"
                  variant={formData.serviceName === service ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateField('serviceName', service)}
                >
                  {service}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceName">Nombre del trabajo *</Label>
                <Input
                  id="serviceName"
                  value={formData.serviceName}
                  onChange={(event) => updateField('serviceName', event.target.value)}
                  placeholder="Ej: Limpieza puntual oficina"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceAddress">Dirección del trabajo *</Label>
                <Input
                  id="serviceAddress"
                  value={formData.serviceAddress}
                  onChange={(event) => updateField('serviceAddress', event.target.value)}
                  placeholder="Dirección donde se realiza"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Instrucciones internas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Material necesario, acceso, persona de contacto, detalles del servicio..."
                rows={3}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Planificación
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="serviceDate">Fecha *</Label>
                <Input
                  id="serviceDate"
                  type="date"
                  value={formData.serviceDate}
                  onChange={(event) => updateField('serviceDate', event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Inicio *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(event) => updateField('startTime', event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Duración</Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  min="15"
                  step="15"
                  value={formData.durationMinutes}
                  onChange={(event) => updateField('durationMinutes', parseInt(event.target.value, 10) || 0)}
                />
              </div>

              <div className="space-y-2">
                <Label>Fin previsto</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  {addMinutesToTime(formData.startTime, formData.durationMinutes)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={formData.durationMinutes === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateField('durationMinutes', option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Trabajador asignado</Label>
              <Select
                value={formData.cleanerId || 'unassigned'}
                onValueChange={handleCleanerChange}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? 'Cargando trabajadores...' : 'Sin asignar'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {activeCleaners.map((cleaner) => (
                    <SelectItem key={cleaner.id} value={cleaner.id}>
                      {cleaner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              Cliente y facturación opcional
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="clientName">Cliente o contacto</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(event) => updateField('clientName', event.target.value)}
                  placeholder="Nombre del cliente o contacto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Teléfono</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(event) => updateField('phoneNumber', event.target.value)}
                  placeholder="+34 600 000 000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="email@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceCost">Importe</Label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="serviceCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.serviceCost}
                    onChange={(event) => updateField('serviceCost', parseFloat(event.target.value) || 0)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="space-y-2">
                <Label htmlFor="billingAddress">Dirección de facturación</Label>
                <Input
                  id="billingAddress"
                  value={formData.billingAddress}
                  onChange={(event) => updateField('billingAddress', event.target.value)}
                  placeholder="Si es distinta a la dirección del trabajo"
                />
              </div>

              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={formData.paymentMethod} onValueChange={(value) => updateField('paymentMethod', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="bizum">Bizum</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="factura">Factura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="needsInvoice"
                checked={formData.needsInvoice}
                onCheckedChange={(checked) => updateField('needsInvoice', checked === true)}
              />
              <Label htmlFor="needsInvoice">Marcar como factura requerida en las notas</Label>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Crear tarea extraordinaria
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
