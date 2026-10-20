
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Building2 } from 'lucide-react';
import { useCreateCleaner } from "@/hooks/useCleaners";
import { useSede } from '@/contexts/SedeContext';
import { Cleaner } from '@/types/calendar';
import {
  STANDARD_WORKER_CATEGORIES,
  findPossibleDuplicates,
  parseHours,
  validateWorkerForm,
} from '@/features/personnel/workerForm';
import { toast } from '@/hooks/use-toast';

interface CreateWorkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Equipo cargado de la sede activa, para avisar de posibles duplicados. */
  existingWorkers?: Cleaner[];
}

interface CreateWorkerForm {
  name: string;
  email: string;
  telefono: string;
  isActive: boolean;
  contractHours: string;
  category: string;
  startDate: string;
}

const EMPTY_FORM: CreateWorkerForm = {
  name: '',
  email: '',
  telefono: '',
  isActive: true,
  contractHours: '',
  category: 'Operario de limpieza',
  startDate: '',
};

export const CreateWorkerModal = ({ open, onOpenChange, existingWorkers = [] }: CreateWorkerModalProps) => {
  const { availableSedes, activeSede } = useSede();
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [formData, setFormData] = useState<CreateWorkerForm>(EMPTY_FORM);
  const [touched, setTouched] = useState(false);
  const [confirmedDuplicates, setConfirmedDuplicates] = useState(false);

  const createCleaner = useCreateCleaner();
  const errors = validateWorkerForm(formData);
  const invalid = Object.keys(errors).length > 0;
  // Solo se compara con la sede cargada en el listado.
  const duplicates = useMemo(
    () => (selectedSedeId && selectedSedeId === activeSede?.id ? findPossibleDuplicates(existingWorkers, formData) : []),
    [existingWorkers, formData, selectedSedeId, activeSede?.id],
  );
  useEffect(() => setConfirmedDuplicates(false), [formData.name, formData.email, formData.telefono]);

  // Auto-seleccionar sede activa si existe
  useEffect(() => {
    if (activeSede && availableSedes.length > 0) {
      setSelectedSedeId(activeSede.id);
    } else if (availableSedes.length === 1) {
      setSelectedSedeId(availableSedes[0].id);
    }
  }, [activeSede, availableSedes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid || !selectedSedeId) return;
    if (duplicates.length && !confirmedDuplicates) return;

    const otherSede = selectedSedeId !== activeSede?.id ? availableSedes.find(s => s.id === selectedSedeId) : null;
    createCleaner.mutate(
      {
        name: formData.name.trim(),
        email: formData.email.trim(),
        telefono: formData.telefono.trim(),
        isActive: formData.isActive,
        contractHoursPerWeek: parseHours(formData.contractHours) ?? 0,
        category: formData.category,
        startDate: formData.startDate,
        sede_id: selectedSedeId,
      },
      {
        onSuccess: () => {
          if (otherSede) {
            toast({
              title: 'Creado en otra sede',
              description: "Para verlo, cambia a la sede «" + otherSede.nombre + "» en el selector de sede.",
            });
          }
          onOpenChange(false);
          setSelectedSedeId('');
          setFormData(EMPTY_FORM);
          setTouched(false);
        },
      }
    );
  };

  const handleChange = (field: keyof CreateWorkerForm, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectedSede = availableSedes.find(s => s.id === selectedSedeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[92dvh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nuevo trabajador</DialogTitle>
          <DialogDescription>
            Añade un nuevo trabajador a tu equipo de limpieza.
          </DialogDescription>
        </DialogHeader>
        
        {availableSedes.length === 0 ? (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No tienes sedes asignadas. Contacta al administrador para obtener acceso.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Solo para casos excepcionales.</strong> Lo normal es dar de alta al trabajador en <strong>REGISTRO</strong> (la app de gestión) y luego ir a <strong>Integraciones · REGISTRO</strong>: al vincularlo se crea aquí automáticamente con DNI, PIN y categoría, y se le envía la invitación por email para que cree su contraseña. Los trabajadores creados a mano aquí <strong>no tendrán DNI ni PIN de REGISTRO</strong> y tampoco recibirán invitación automática.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="sede">Sede *</Label>
              <Select value={selectedSedeId} onValueChange={setSelectedSedeId} required>
                <SelectTrigger className="bg-background border border-border">
                  <SelectValue placeholder="Selecciona una sede">
                    {selectedSede && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {selectedSede.nombre}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg">
                  {availableSedes.map((sede) => (
                    <SelectItem key={sede.id} value={sede.id} className="hover:bg-accent">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {sede.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSede && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  📍 Creando trabajador en: <strong>{selectedSede.nombre}</strong>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Nombre del trabajador"
                required
                aria-invalid={(touched && !!errors.name) || undefined}
              />
              {touched && errors.name && <p className="text-sm text-destructive" role="alert">{errors.name}</p>}
            </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="email@ejemplo.com"
              aria-invalid={(touched && !!errors.email) || undefined}
            />
            {touched && errors.email && <p className="text-sm text-destructive" role="alert">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={formData.telefono}
              onChange={(e) => handleChange('telefono', e.target.value)}
              placeholder="123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractHoursPerWeek">Horas semanales por contrato</Label>
            <Input
              id="contractHoursPerWeek"
              inputMode="decimal"
              value={formData.contractHours}
              onChange={(e) => handleChange('contractHours', e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="0"
              aria-invalid={(touched && !!errors.contractHours) || undefined}
            />
            {touched && errors.contractHours
              ? <p className="text-sm text-destructive" role="alert">{errors.contractHours}</p>
              : <p className="text-xs text-muted-foreground">Entre 0 y 80, en cuartos de hora. Si no indicas horas, se guardará 0.</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoría / puesto</Label>
              <Select
                value={formData.category || 'Operario de limpieza'}
                onValueChange={(value) => handleChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_WORKER_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de alta</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleChange('isActive', checked)}
            />
            <Label htmlFor="isActive">Trabajador activo</Label>
          </div>

          {duplicates.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50" role="alert">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-900">
                <strong>Posible duplicado en esta sede:</strong>{' '}
                {duplicates.map(d => d.name + (d.isActive === false ? ' (inactivo)' : '') + ' — coincide ' + d.reasons.join(', ')).join('; ')}.
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={confirmedDuplicates}
                    onChange={(e) => setConfirmedDuplicates(e.target.checked)}
                  />
                  Es otra persona: crear de todos modos
                </label>
              </AlertDescription>
            </Alert>
          )}

           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancelar
             </Button>
             <Button type="submit" disabled={createCleaner.isPending || !selectedSedeId || !formData.name.trim() || (duplicates.length > 0 && !confirmedDuplicates)}>
               {createCleaner.isPending ? 'Creando…' : 'Crear trabajador'}
             </Button>
           </DialogFooter>
           </form>
         )}
       </DialogContent>
     </Dialog>
   );
 };
