
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Plus } from 'lucide-react';
import { useCreateProperty } from '@/hooks/useProperties';
import { propertySchema, PropertyFormData } from './forms/PropertyFormSchema';
import { BasicInfoSection } from './forms/BasicInfoSection';
import { CharacteristicsSection } from './forms/CharacteristicsSection';
import { ServiceSection } from './forms/ServiceSection';
import { TextileSection } from './forms/TextileSection';
import { NotesSection } from './forms/NotesSection';
import { ClientSelectionSection } from './forms/ClientSelectionSection';
import { CreatePropertyData } from '@/types/property';

export const CreatePropertyModal = () => {
  const [open, setOpen] = useState(false);
  const createProperty = useCreateProperty();

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      codigo: '',
      nombre: '',
      direccion: '',
      numeroCamas: 1,
      numeroBanos: 1,
      duracionServicio: 120,
      costeServicio: 0,
      numeroSabanas: 0,
      numeroToallasGrandes: 0,
      numeroTotallasPequenas: 0,
      numeroAlfombrines: 0,
      numeroFundasAlmohada: 0,
      notas: '',
      clienteId: '',
    },
  });

  const onSubmit = (data: PropertyFormData) => {
    // Explicitly cast to CreatePropertyData to ensure type safety
    const propertyData: CreatePropertyData = {
      codigo: data.codigo,
      nombre: data.nombre,
      direccion: data.direccion,
      numeroCamas: data.numeroCamas,
      numeroBanos: data.numeroBanos,
      duracionServicio: data.duracionServicio,
      costeServicio: data.costeServicio,
      numeroSabanas: data.numeroSabanas,
      numeroToallasGrandes: data.numeroToallasGrandes,
      numeroTotallasPequenas: data.numeroTotallasPequenas,
      numeroAlfombrines: data.numeroAlfombrines,
      numeroFundasAlmohada: data.numeroFundasAlmohada,
      notas: data.notas || '',
      clienteId: data.clienteId,
    };

    createProperty.mutate(propertyData, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700">
          <Plus className="h-4 w-4" />
          Nueva Propiedad
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-600 flex items-center gap-2">
            🏠 Crear Nueva Propiedad
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
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createProperty.isPending}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
              >
                {createProperty.isPending ? 'Creando...' : 'Crear Propiedad'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
