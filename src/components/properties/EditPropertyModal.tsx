
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useUpdateProperty } from '@/hooks/useProperties';
import { propertySchema, PropertyFormData } from './forms/PropertyFormSchema';
import { BasicInfoSection } from './forms/BasicInfoSection';
import { CharacteristicsSection } from './forms/CharacteristicsSection';
import { ServiceSection } from './forms/ServiceSection';
import { TextileSection } from './forms/TextileSection';
import { NotesSection } from './forms/NotesSection';
import { ClientSelectionSection } from './forms/ClientSelectionSection';
import { Property, CreatePropertyData } from '@/types/property';

interface EditPropertyModalProps {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditPropertyModal = ({ property, open, onOpenChange }: EditPropertyModalProps) => {
  const updateProperty = useUpdateProperty();

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
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
      notas: property.notas,
      clienteId: property.clienteId,
    },
  });

  // Reset form when property changes
  useEffect(() => {
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
      notas: property.notas,
      clienteId: property.clienteId,
    });
  }, [property, form]);

  const onSubmit = (data: PropertyFormData) => {
    const propertyData: CreatePropertyData = {
      codigo: data.codigo,
      nombre: data.nombre,
      direccion: data.direccion,
      numeroCamas: data.numeroCamas,
      numeroBanos: data.numeroBanos,
      duracionServicio: data.duracionServicio,
      costeServicio: data.costeServicio,
      checkInPredeterminado: data.checkInPredeterminado,
      checkOutPredeterminado: data.checkOutPredeterminado,
      numeroSabanas: data.numeroSabanas,
      numeroToallasGrandes: data.numeroToallasGrandes,
      numeroTotallasPequenas: data.numeroTotallasPequenas,
      numeroAlfombrines: data.numeroAlfombrines,
      numeroFundasAlmohada: data.numeroFundasAlmohada,
      notas: data.notas || '',
      clienteId: data.clienteId,
    };

    updateProperty.mutate({ id: property.id, updates: propertyData }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-600 flex items-center gap-2">
            ✏️ Editar Propiedad: {property.nombre}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <ClientSelectionSection control={form.control} />
            <BasicInfoSection control={form.control} />
            <CharacteristicsSection control={form.control} />
            <ServiceSection control={form.control} />
            <TextileSection control={form.control} />
            <NotesSection control={form.control} />
            
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateProperty.isPending}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                {updateProperty.isPending ? 'Actualizando...' : 'Actualizar Propiedad'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
