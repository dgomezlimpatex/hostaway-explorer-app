import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Package, Truck } from 'lucide-react';
import { LaundryDeliveryStatus } from '@/hooks/useLaundryTracking';

interface DeliveryStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetStatus: LaundryDeliveryStatus;
  propertyName: string;
  onConfirm: (personName: string, notes?: string) => void;
}

// Key for storing name in localStorage
const DRIVER_NAME_KEY = 'laundry_driver_name';

export const DeliveryStatusModal = ({
  open,
  onOpenChange,
  targetStatus,
  propertyName,
  onConfirm,
}: DeliveryStatusModalProps) => {
  const [personName, setPersonName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Load saved name from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem(DRIVER_NAME_KEY);
    if (savedName) {
      setPersonName(savedName);
    }
  }, []);

  const handleConfirm = () => {
    if (!personName.trim()) {
      setError('Por favor, introduce tu nombre');
      return;
    }

    // Save name for future use
    localStorage.setItem(DRIVER_NAME_KEY, personName.trim());
    
    onConfirm(personName.trim(), notes.trim() || undefined);
    setNotes('');
    setError('');
  };

  const handleClose = () => {
    setNotes('');
    setError('');
    onOpenChange(false);
  };

  const statusConfig = {
    prepared: {
      title: 'Marcar como Preparada',
      description: 'Confirma que la bolsa de lavandería está preparada para entrega.',
      icon: Package,
      buttonText: 'Confirmar Preparada',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
    delivered: {
      title: 'Marcar como Entregada',
      description: 'Confirma que la bolsa ha sido entregada en la propiedad.',
      icon: Truck,
      buttonText: 'Confirmar Entrega',
      buttonClass: 'bg-green-600 hover:bg-green-700',
    },
    pending: {
      title: '',
      description: '',
      icon: Package,
      buttonText: '',
      buttonClass: '',
    },
  };

  const config = statusConfig[targetStatus];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Property name */}
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm text-muted-foreground">Propiedad:</p>
            <p className="font-medium">{propertyName}</p>
          </div>

          {/* Person name input */}
          <div className="space-y-2">
            <Label htmlFor="personName">Tu nombre *</Label>
            <Input
              id="personName"
              placeholder="Ej: Juan Pérez"
              value={personName}
              onChange={(e) => {
                setPersonName(e.target.value);
                setError('');
              }}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Tu nombre se guardará para futuras entregas
            </p>
          </div>

          {/* Notes input */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Alguna observación sobre la entrega..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className={config.buttonClass}>
            {config.buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
