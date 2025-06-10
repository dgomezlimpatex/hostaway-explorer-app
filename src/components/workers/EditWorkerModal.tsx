
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
import { useUpdateCleaner } from "@/hooks/useCleaners";
import { CreateCleanerData } from "@/services/cleanerStorage";
import { Cleaner } from "@/types/calendar";

interface EditWorkerModalProps {
  worker: Cleaner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditWorkerModal = ({ worker, open, onOpenChange }: EditWorkerModalProps) => {
  const [formData, setFormData] = useState<CreateCleanerData>({
    name: '',
    email: '',
    telefono: '',
    avatar: '',
    isActive: true,
  });

  const updateCleaner = useUpdateCleaner();

  useEffect(() => {
    if (worker) {
      setFormData({
        name: worker.name,
        email: worker.email || '',
        telefono: worker.telefono || '',
        avatar: worker.avatar || '',
        isActive: worker.isActive,
      });
    }
  }, [worker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!worker || !formData.name.trim()) {
      return;
    }

    updateCleaner.mutate(
      { id: worker.id, updates: formData },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleChange = (field: keyof CreateCleanerData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Trabajador</DialogTitle>
          <DialogDescription>
            Modifica la información del trabajador.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" disabled={updateCleaner.isPending}>
              {updateCleaner.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
