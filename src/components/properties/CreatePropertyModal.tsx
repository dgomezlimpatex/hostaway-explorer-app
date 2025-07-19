
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
import { BathroomAmenitiesSection } from './forms/BathroomAmenitiesSection';
import { KitchenAmenitiesSection } from './forms/KitchenAmenitiesSection';
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
      checkInPredeterminado: '15:00',
      checkOutPredeterminado: '11:00',
      numeroSabanas: 0,
      numeroToallasGrandes: 0,
      numeroTotallasPequenas: 0,
      numeroAlfombrines: 0,
      numeroFundasAlmohada: 0,
      kitAlimentario: 0,
      
      // Amenities de baño
      jabonLiquido: 0,
      gelDucha: 0,
      champu: 0,
      acondicionador: 0,
      papelHigienico: 0,
      ambientadorBano: 0,
      desinfectanteBano: 0,
      
      // Amenities de cocina
      aceite: 0,
      sal: 0,
      azucar: 0,
      vinagre: 0,
      detergenteLavavajillas: 0,
      limpiacristales: 0,
      bayetasCocina: 0,
      estropajos: 0,
      bolsasBasura: 0,
      papelCocina: 0,
      
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
      checkInPredeterminado: data.checkInPredeterminado,
      checkOutPredeterminado: data.checkOutPredeterminado,
      numeroSabanas: data.numeroSabanas,
      numeroToallasGrandes: data.numeroToallasGrandes,
      numeroTotallasPequenas: data.numeroTotallasPequenas,
      numeroAlfombrines: data.numeroAlfombrines,
      numeroFundasAlmohada: data.numeroFundasAlmohada,
      kitAlimentario: data.kitAlimentario,
      
      // Amenities de baño
      jabonLiquido: data.jabonLiquido,
      gelDucha: data.gelDucha,
      champu: data.champu,
      acondicionador: data.acondicionador,
      papelHigienico: data.papelHigienico,
      ambientadorBano: data.ambientadorBano,
      desinfectanteBano: data.desinfectanteBano,
      
      // Amenities de cocina
      aceite: data.aceite,
      sal: data.sal,
      azucar: data.azucar,
      vinagre: data.vinagre,
      detergenteLavavajillas: data.detergenteLavavajillas,
      limpiacristales: data.limpiacristales,
      bayetasCocina: data.bayetasCocina,
      estropajos: data.estropajos,
      bolsasBasura: data.bolsasBasura,
      papelCocina: data.papelCocina,
      
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
            <BathroomAmenitiesSection control={form.control} />
            <KitchenAmenitiesSection control={form.control} />
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
