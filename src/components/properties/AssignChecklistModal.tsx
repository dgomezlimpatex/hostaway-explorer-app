
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useChecklistTemplates } from '@/hooks/useChecklistTemplates';
import { useAssignChecklistToProperty } from '@/hooks/usePropertyChecklists';
import { Property } from '@/types/property';
import { useToast } from '@/hooks/use-toast';

interface AssignChecklistModalProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AssignChecklistModal: React.FC<AssignChecklistModalProps> = ({
  property,
  open,
  onOpenChange,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const { data: templates = [] } = useChecklistTemplates();
  const assignChecklistMutation = useAssignChecklistToProperty();
  const { toast } = useToast();

  const handleAssign = async () => {
    if (!selectedTemplateId) {
      toast({
        title: "Error",
        description: "Por favor selecciona una plantilla de checklist.",
        variant: "destructive",
      });
      return;
    }

    if (!property) {
      toast({
        title: "Error",
        description: "No se ha seleccionado una propiedad.",
        variant: "destructive",
      });
      return;
    }

    try {
      await assignChecklistMutation.mutateAsync({
        propertyId: property.id,
        templateId: selectedTemplateId,
      });
      
      onOpenChange(false);
      setSelectedTemplateId('');
    } catch (error) {
      console.error('Error assigning checklist:', error);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedTemplateId('');
  };

  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Plantilla de Checklist</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Propiedad</Label>
            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {property.nombre} - {property.codigo}
            </p>
          </div>
          
          <div>
            <Label htmlFor="template-select" className="text-sm font-medium text-gray-700">
              Plantilla de Checklist
            </Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plantilla..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.template_name} ({template.property_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={assignChecklistMutation.isPending}
          >
            {assignChecklistMutation.isPending ? 'Asignando...' : 'Asignar Plantilla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
