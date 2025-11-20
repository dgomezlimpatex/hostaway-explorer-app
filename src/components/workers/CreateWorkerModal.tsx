
import { useState, useEffect } from 'react';
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
import { CreateCleanerData } from "@/services/cleanerStorage";

interface CreateWorkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateWorkerModal = ({ open, onOpenChange }: CreateWorkerModalProps) => {
  const { availableSedes, activeSede } = useSede();
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [formData, setFormData] = useState<CreateCleanerData>({
    name: '',
    email: '',
    telefono: '',
    avatar: '',
    isActive: true,
    contractHoursPerWeek: 40,
    hourlyRate: undefined,
    contractType: 'full-time',
    startDate: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const createCleaner = useCreateCleaner();

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
    
    if (!formData.name.trim() || !selectedSedeId) {
      return;
    }

    createCleaner.mutate(
      { ...formData, sede_id: selectedSedeId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedSedeId('');
          setFormData({
            name: '',
            email: '',
            telefono: '',
            avatar: '',
            isActive: true,
            contractHoursPerWeek: 40,
            hourlyRate: undefined,
            contractType: 'full-time',
            startDate: '',
            emergencyContactName: '',
            emergencyContactPhone: '',
          });
        },
      }
    );
  };

  const handleChange = (field: keyof CreateCleanerData, value: string | boolean | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const selectedSede = availableSedes.find(s => s.id === selectedSedeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Trabajador</DialogTitle>
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
          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@ejemplo.com"
            />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractHoursPerWeek">Horas de Contrato/Semana</Label>
              <Input
                id="contractHoursPerWeek"
                type="number"
                value={formData.contractHoursPerWeek || ''}
                onChange={(e) => handleChange('contractHoursPerWeek', parseFloat(e.target.value) || 0)}
                placeholder="40"
                min="0"
                step="0.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Tarifa por Hora (€)</Label>
              <Input
                id="hourlyRate"
                type="number"
                value={formData.hourlyRate || ''}
                onChange={(e) => handleChange('hourlyRate', parseFloat(e.target.value) || undefined)}
                placeholder="15.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractType">Tipo de Contrato</Label>
              <Select value={formData.contractType} onValueChange={(value) => handleChange('contractType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Tiempo Completo</SelectItem>
                  <SelectItem value="part-time">Tiempo Parcial</SelectItem>
                  <SelectItem value="temporary">Temporal</SelectItem>
                  <SelectItem value="freelance">Autónomo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">Contacto de Emergencia</Label>
            <Input
              id="emergencyContactName"
              value={formData.emergencyContactName}
              onChange={(e) => handleChange('emergencyContactName', e.target.value)}
              placeholder="Nombre del contacto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">Teléfono de Emergencia</Label>
            <Input
              id="emergencyContactPhone"
              value={formData.emergencyContactPhone}
              onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
              placeholder="123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar">URL del Avatar</Label>
            <Input
              id="avatar"
              value={formData.avatar}
              onChange={(e) => handleChange('avatar', e.target.value)}
              placeholder="https://ejemplo.com/avatar.jpg"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleChange('isActive', checked)}
            />
            <Label htmlFor="isActive">Trabajador activo</Label>
          </div>

           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancelar
             </Button>
             <Button type="submit" disabled={createCleaner.isPending || !selectedSedeId || !formData.name.trim()}>
               {createCleaner.isPending ? 'Creando...' : 'Crear Trabajador'}
             </Button>
           </DialogFooter>
           </form>
         )}
       </DialogContent>
     </Dialog>
   );
 };
