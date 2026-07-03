
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

const WORKER_CATEGORY_OPTIONS = [
  'Operario de limpieza',
  'Supervisor',
  'Administrador',
] as const;

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
    isActive: true,
    category: 'Operario de limpieza',
    startDate: '',
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
            isActive: true,
            category: 'Operario de limpieza',
            startDate: '',
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
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Solo para casos excepcionales.</strong> Lo normal es dar de alta al trabajador en <strong>REGISTRO</strong> (la app de gestión) y luego ir a <strong>Integraciones · REGISTRO</strong>: al vincularlo se crea aquí automáticamente con DNI, PIN y categoría, y se le envía la invitación por email para que cree su contraseña. Los trabajadores creados a mano aquí <strong>no tendrán DNI, PIN ni categoría</strong> y tampoco recibirán invitación automática.
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
              <Label htmlFor="category">Categoría / puesto</Label>
              <Select
                value={formData.category || 'Operario de limpieza'}
                onValueChange={(value) => handleChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
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
