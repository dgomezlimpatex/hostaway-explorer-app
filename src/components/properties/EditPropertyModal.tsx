
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Property } from '@/types/property';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { propertySchema, PropertyFormData } from './forms/PropertyFormSchema';
import { useUpdateProperty } from '@/hooks/useProperties';
import { BasicInfoSection } from './forms/BasicInfoSection';
import { CharacteristicsSection } from './forms/CharacteristicsSection';
import { ServiceSection } from './forms/ServiceSection';
import { TextileSection } from './forms/TextileSection';
import { NotesSection } from './forms/NotesSection';
import { ClientSelectionSection } from './forms/ClientSelectionSection';
import { 
  Home,
  Save,
  X
} from 'lucide-react';

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
  const updateProperty = useUpdateProperty();

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: property ? {
      codigo: property.codigo,
      nombre: property.nombre,
      direccion: property.direccion,
      numeroCamas: property.numeroCamas,
      numeroBanos: property.numeroBanos,
      duracionServicio: property.duracionServicio,
      costeServicio: property.costeServicio,
      checkInPredeterminado: property.checkInPredeterminado,
      checkOutPredeterminado: property.checkOutPredeterminado,
      numeroSabanas: property.numeroSabanas,
      numeroToallasGrandes: property.numeroToallasGrandes,
      numeroTotallasPequenas: property.numeroTotallasPequenas,
      numeroAlfombrines: property.numeroAlfombrines,
      numeroFundasAlmohada: property.numeroFundasAlmohada,
      notas: property.notas || '',
      clienteId: property.clienteId,
    } : undefined,
  });

  // Reset form when property changes
  React.useEffect(() => {
    if (property) {
      form.reset({
        codigo: property.codigo,
        nombre: property.nombre,
        direccion: property.direccion,
        numeroCamas: property.numeroCamas,
        numeroBanos: property.numeroBanos,
        duracionServicio: property.duracionServicio,
        costeServicio: property.costeServicio,
        checkInPredeterminado: property.checkInPredeterminado,
        checkOutPredeterminado: property.checkOutPredeterminado,
        numeroSabanas: property.numeroSabanas,
        numeroToallasGrandes: property.numeroToallasGrandes,
        numeroTotallasPequenas: property.numeroTotallasPequenas,
        numeroAlfombrines: property.numeroAlfombrines,
        numeroFundasAlmohada: property.numeroFundasAlmohada,
        notas: property.notas || '',
        clienteId: property.clienteId,
      });
    }
  }, [property, form]);

  const onSubmit = async (data: PropertyFormData) => {
    if (!property) return;

    try {
      await updateProperty.mutateAsync({
        id: property.id,
        updates: data
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating property:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  // Don't render if property is null
  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Home className="h-6 w-6 text-blue-600" />
            Editar Propiedad: {property.nombre}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <BasicInfoSection control={form.control} />
            
            <CharacteristicsSection control={form.control} />
            
            <ServiceSection control={form.control} />
            
            <TextileSection control={form.control} />
            
            <NotesSection control={form.control} />
            
            <ClientSelectionSection control={form.control} />

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateProperty.isPending}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateProperty.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
