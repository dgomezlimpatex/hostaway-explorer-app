
import { useState } from 'react';
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
import { useCreateCleaner } from "@/hooks/useCleaners";
import { CreateCleanerData } from "@/services/cleanerStorage";

interface CreateWorkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateWorkerModal = ({ open, onOpenChange }: CreateWorkerModalProps) => {
  const [formData, setFormData] = useState<CreateCleanerData>({
    name: '',
    email: '',
    telefono: '',
    avatar: '',
    isActive: true,
  });

  const createCleaner = useCreateCleaner();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    createCleaner.mutate(formData, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          name: '',
          email: '',
          telefono: '',
          avatar: '',
          isActive: true,
        });
      },
    });
  };

  const handleChange = (field: keyof CreateCleanerData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Trabajador</DialogTitle>
          <DialogDescription>
            Añade un nuevo trabajador a tu equipo de limpieza.
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
            <Button type="submit" disabled={createCleaner.isPending}>
              {createCleaner.isPending ? 'Creando...' : 'Crear Trabajador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
