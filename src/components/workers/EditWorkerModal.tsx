
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

          <div className="space-y-2 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-emerald-700 dark:text-emerald-300 font-semibold">
                🔗 Datos sincronizados desde REGISTRO
              </Label>
              {worker.externalId ? (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-medium">
                  Vinculado
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                  Solo local
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Estos campos se sincronizan automáticamente. Para editarlos, modifícalos en REGISTRO.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Nombre</span>
                <strong>{worker.firstName || '—'}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Apellidos</span>
                <strong>{worker.lastName || '—'}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">DNI</span>
                <strong>{worker.dni || '—'}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">PIN</span>
                <strong>{worker.pin || '—'}</strong>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground block text-xs">Categoría</span>
                <strong>{worker.category || '—'}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Delegación</span>
                <strong>{worker.delegationName || '—'}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Oficina</span>
                <strong>{worker.officeName || '—'}</strong>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground block text-xs">ID externo (REGISTRO)</span>
                <strong className="font-mono text-xs">{worker.externalId || '—'}</strong>
              </div>
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
            <Button type="submit" disabled={updateCleaner.isPending}>
              {updateCleaner.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
