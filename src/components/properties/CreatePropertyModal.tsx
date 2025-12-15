
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertTriangle } from 'lucide-react';
import { useCreateProperty } from '@/hooks/useProperties';
import { useSede } from '@/contexts/SedeContext';
import { propertySchema, PropertyFormData } from './forms/PropertyFormSchema';
import { BasicInfoSection } from './forms/BasicInfoSection';
import { CharacteristicsSection } from './forms/CharacteristicsSection';
import { ServiceSection } from './forms/ServiceSection';
import { TextileSection } from './forms/TextileSection';
import { AmenitiesSection } from './forms/AmenitiesSection';
import { NotesSection } from './forms/NotesSection';
import { ClientSelectionSection } from './forms/ClientSelectionSection';
import { CreatePropertyData } from '@/types/property';

export const CreatePropertyModal = () => {
  const [open, setOpen] = useState(false);
  const { activeSede, isActiveSedeSet } = useSede();
  const createProperty = useCreateProperty();

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      codigo: '',
      nombre: '',
      direccion: '',
      numeroCamas: 1,
      numeroCamasPequenas: 0,
      numeroCamasSuite: 0,
      numeroSofasCama: 0,
      numeroBanos: 1,
      duracionServicio: 120,
      costeServicio: 0,
      checkInPredeterminado: '15:00',
      checkOutPredeterminado: '11:00',
      numeroSabanas: 0,
      numeroSabanasRequenas: 0,
      numeroSabanasSuite: 0,
      numeroToallasGrandes: 0,
      numeroTotallasPequenas: 0,
      numeroAlfombrines: 0,
      numeroFundasAlmohada: 0,
      kitAlimentario: 0,
      amenitiesBano: 0,
      amenitiesCocina: 0,
      cantidadRollosPapelHigienico: 0,
      cantidadRollosPapelCocina: 0,
      notas: '',
      clienteId: '',
      linenControlEnabled: null,
    },
  });

  const onSubmit = (data: PropertyFormData) => {
    if (!isActiveSedeSet()) {
      return;
    }

    // Explicitly cast to CreatePropertyData to ensure type safety
    const propertyData: CreatePropertyData = {
      codigo: data.codigo,
      nombre: data.nombre,
      direccion: data.direccion,
      numeroCamas: data.numeroCamas,
      numeroCamasPequenas: data.numeroCamasPequenas,
      numeroCamasSuite: data.numeroCamasSuite,
      numeroSofasCama: data.numeroSofasCama,
      numeroBanos: data.numeroBanos,
      duracionServicio: data.duracionServicio,
      costeServicio: data.costeServicio,
      checkInPredeterminado: data.checkInPredeterminado,
      checkOutPredeterminado: data.checkOutPredeterminado,
      numeroSabanas: data.numeroSabanas,
      numeroSabanasRequenas: data.numeroSabanasRequenas,
      numeroSabanasSuite: data.numeroSabanasSuite,
      numeroToallasGrandes: data.numeroToallasGrandes,
      numeroTotallasPequenas: data.numeroTotallasPequenas,
      numeroAlfombrines: data.numeroAlfombrines,
      numeroFundasAlmohada: data.numeroFundasAlmohada,
      kitAlimentario: data.kitAlimentario,
      amenitiesBano: data.amenitiesBano,
      amenitiesCocina: data.amenitiesCocina,
      cantidadRollosPapelHigienico: data.cantidadRollosPapelHigienico,
      cantidadRollosPapelCocina: data.cantidadRollosPapelCocina,
      notas: data.notas || '',
      clienteId: data.clienteId,
      linenControlEnabled: data.linenControlEnabled ?? null,
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
        
        {!isActiveSedeSet() ? (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Debes seleccionar una sede antes de crear una propiedad.
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  📍 Creando propiedad en: <strong>{activeSede?.nombre}</strong>
                </p>
              </div>

              <ClientSelectionSection control={form.control} />
              <BasicInfoSection control={form.control} />
              <CharacteristicsSection control={form.control} />
              <ServiceSection control={form.control} />
              <TextileSection control={form.control} />
              <AmenitiesSection control={form.control} />
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
                  disabled={createProperty.isPending || !isActiveSedeSet()}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  {createProperty.isPending ? 'Creando...' : 'Crear Propiedad'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
