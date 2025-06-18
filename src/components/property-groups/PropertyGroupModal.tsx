
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreatePropertyGroup, useUpdatePropertyGroup } from '@/hooks/usePropertyGroups';
import { PropertyGroup } from '@/types/propertyGroups';

interface PropertyGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: PropertyGroup | null;
}

export const PropertyGroupModal = ({ isOpen, onClose, group }: PropertyGroupModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    checkOutTime: '11:00',
    checkInTime: '17:00',
    isActive: true,
    autoAssignEnabled: true,
  });

  const createGroup = useCreatePropertyGroup();
  const updateGroup = useUpdatePropertyGroup();

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || '',
        checkOutTime: group.checkOutTime,
        checkInTime: group.checkInTime,
        isActive: group.isActive,
        autoAssignEnabled: group.autoAssignEnabled,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        checkOutTime: '11:00',
        checkInTime: '17:00',
        isActive: true,
        autoAssignEnabled: true,
      });
    }
  }, [group, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (group) {
        await updateGroup.mutateAsync({ id: group.id, updates: formData });
      } else {
        await createGroup.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error('Error saving group:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {group ? 'Editar Grupo' : 'Crear Nuevo Grupo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre del Grupo</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Edificio Malagueta"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción opcional del grupo"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="checkOut">Check-out</Label>
              <Input
                id="checkOut"
                type="time"
                value={formData.checkOutTime}
                onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="checkIn">Check-in</Label>
              <Input
                id="checkIn"
                type="time"
                value={formData.checkInTime}
                onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Grupo Activo</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoAssign">Asignación Automática</Label>
              <Switch
                id="autoAssign"
                checked={formData.autoAssignEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, autoAssignEnabled: checked })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createGroup.isPending || updateGroup.isPending}
            >
              {group ? 'Actualizar' : 'Crear'} Grupo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
