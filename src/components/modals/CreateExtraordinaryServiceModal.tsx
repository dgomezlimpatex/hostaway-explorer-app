import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ExtraordinaryServiceData {
  clientName: string;
  billingAddress: string;
  email: string;
  phoneNumber: string;
  serviceAddress: string;
  serviceDuration: number;
  serviceCost: number;
  needsInvoice: boolean;
  notes: string;
}

interface CreateExtraordinaryServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateService: (serviceData: ExtraordinaryServiceData) => Promise<void>;
  currentDate?: Date;
}

export const CreateExtraordinaryServiceModal = ({ 
  open, 
  onOpenChange, 
  onCreateService,
  currentDate = new Date()
}: CreateExtraordinaryServiceModalProps) => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<ExtraordinaryServiceData>({
    clientName: '',
    billingAddress: '',
    email: '',
    phoneNumber: '',
    serviceAddress: '',
    serviceDuration: 60,
    serviceCost: 0,
    needsInvoice: false,
    notes: ''
  });

  const handleChange = (field: keyof ExtraordinaryServiceData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      clientName: '',
      billingAddress: '',
      email: '',
      phoneNumber: '',
      serviceAddress: '',
      serviceDuration: 60,
      serviceCost: 0,
      needsInvoice: false,
      notes: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!formData.clientName.trim()) {
      toast({
        title: "Error",
        description: "El nombre del cliente es obligatorio.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast({
        title: "Error",
        description: "Ingresa un email válido.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.serviceAddress.trim()) {
      toast({
        title: "Error",
        description: "La dirección del servicio es obligatoria.",
        variant: "destructive",
      });
      return;
    }

    if (formData.serviceDuration <= 0) {
      toast({
        title: "Error",
        description: "La duración del servicio debe ser mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    if (formData.serviceCost <= 0) {
      toast({
        title: "Error",
        description: "El coste del servicio debe ser mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    try {
      await onCreateService(formData);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating extraordinary service:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el servicio extraordinario.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Servicio Extraordinario</DialogTitle>
          <DialogDescription>
            Completa los datos para crear un servicio extraordinario individual.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Nombre del Cliente *</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => handleChange('clientName', e.target.value)}
              placeholder="Nombre completo del cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@ejemplo.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número de Teléfono</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => handleChange('phoneNumber', e.target.value)}
              placeholder="+34 600 000 000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingAddress">Dirección de Facturación</Label>
            <Input
              id="billingAddress"
              value={formData.billingAddress}
              onChange={(e) => handleChange('billingAddress', e.target.value)}
              placeholder="Dirección completa para facturación"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceAddress">Dirección del Servicio *</Label>
            <Input
              id="serviceAddress"
              value={formData.serviceAddress}
              onChange={(e) => handleChange('serviceAddress', e.target.value)}
              placeholder="Dirección donde se realizará el servicio"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serviceDuration">Duración del Servicio (minutos) *</Label>
              <Input
                id="serviceDuration"
                type="number"
                min="15"
                step="15"
                value={formData.serviceDuration}
                onChange={(e) => handleChange('serviceDuration', parseInt(e.target.value) || 0)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="serviceCost">Coste del Servicio (€) *</Label>
              <Input
                id="serviceCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.serviceCost}
                onChange={(e) => handleChange('serviceCost', parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="needsInvoice"
              checked={formData.needsInvoice}
              onCheckedChange={(checked) => handleChange('needsInvoice', !!checked)}
            />
            <Label htmlFor="needsInvoice">¿Necesita factura?</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Añade cualquier información adicional sobre el servicio..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Crear Servicio Extraordinario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};