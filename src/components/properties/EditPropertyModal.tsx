
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Property } from '@/types/property';
import { Button } from '@/components/ui/button';

interface EditPropertyModalProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditPropertyModal: React.FC<EditPropertyModalProps> = ({
  property,
  open,
  onOpenChange,
}) => {
  const handleClose = () => {
    onOpenChange(false);
  };

  // Don't render if property is null
  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Propiedad: {property.codigo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <p className="text-sm text-gray-600">{property.nombre}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Código</label>
              <p className="text-sm text-gray-600">{property.codigo}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Dirección</label>
              <p className="text-sm text-gray-600">{property.direccion}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Camas</label>
              <p className="text-sm text-gray-600">{property.numeroCamas}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Baños</label>
              <p className="text-sm text-gray-600">{property.numeroBanos}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Duración del Servicio</label>
              <p className="text-sm text-gray-600">{property.duracionServicio} min</p>
            </div>
          </div>
          {property.notas && (
            <div>
              <label className="text-sm font-medium">Notas</label>
              <p className="text-sm text-gray-600">{property.notas}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={handleClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
