
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
import { StockConsumptionSection } from './forms/StockConsumptionSection';
import { NotesSection } from './forms/NotesSection';
import { ClientSelectionSection } from './forms/ClientSelectionSection';
import { CreatePropertyData } from '@/types/property';
import { useSavePropertyStockConsumptionRules, useStockProducts } from '@/hooks/useStock';
import { deriveLegacyStockFields } from './forms/propertyStockConsumption';

export const CreatePropertyModal = () => {
  const [open, setOpen] = useState(false);
  const { activeSede, isActiveSedeSet } = useSede();
  const createProperty = useCreateProperty();
  const saveConsumptionRules = useSavePropertyStockConsumptionRules();
  const { data: stockProducts = [] } = useStockProducts();

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
      bayetasCocina: 0,
      bolsasBasura: 0,
      stockConsumptions: {},
      notas: '',
      clienteId: '',
      linenControlEnabled: null,
      isActive: null,
    },
  });

  const onSubmit = async (data: PropertyFormData) => {
    if (!isActiveSedeSet()) {
      return;
    }

    const stockConsumptions = data.stockConsumptions || {};
    const legacyStockFields = deriveLegacyStockFields(stockProducts, stockConsumptions);

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
      numeroSabanas: legacyStockFields.numeroSabanas ?? data.numeroSabanas,
      numeroSabanasRequenas: legacyStockFields.numeroSabanasRequenas ?? data.numeroSabanasRequenas,
      numeroSabanasSuite: legacyStockFields.numeroSabanasSuite ?? data.numeroSabanasSuite,
      numeroToallasGrandes: legacyStockFields.numeroToallasGrandes ?? data.numeroToallasGrandes,
      numeroTotallasPequenas: legacyStockFields.numeroTotallasPequenas ?? data.numeroTotallasPequenas,
      numeroAlfombrines: legacyStockFields.numeroAlfombrines ?? data.numeroAlfombrines,
      numeroFundasAlmohada: legacyStockFields.numeroFundasAlmohada ?? data.numeroFundasAlmohada,
      kitAlimentario: legacyStockFields.kitAlimentario ?? data.kitAlimentario,
      amenitiesBano: legacyStockFields.amenitiesBano ?? data.amenitiesBano,
      amenitiesCocina: legacyStockFields.amenitiesCocina ?? data.amenitiesCocina,
      cantidadRollosPapelHigienico: legacyStockFields.cantidadRollosPapelHigienico ?? data.cantidadRollosPapelHigienico,
      cantidadRollosPapelCocina: legacyStockFields.cantidadRollosPapelCocina ?? data.cantidadRollosPapelCocina,
      bayetasCocina: legacyStockFields.bayetasCocina ?? data.bayetasCocina ?? 0,
      bolsasBasura: legacyStockFields.bolsasBasura ?? data.bolsasBasura ?? 0,
      notas: data.notas || '',
      clienteId: data.clienteId,
      linenControlEnabled: data.linenControlEnabled ?? null,
      isActive: data.isActive ?? null,
    };

    const property = await createProperty.mutateAsync(propertyData);
    await saveConsumptionRules.mutateAsync({
      propertyId: property.id,
      rules: stockProducts.map((product) => ({
        product_id: product.id,
        quantity_per_cleaning: stockConsumptions[product.id] || 0,
      })),
    });
    setOpen(false);
    form.reset();
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
              <StockConsumptionSection control={form.control} setValue={form.setValue} />
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
                  disabled={createProperty.isPending || saveConsumptionRules.isPending || !isActiveSedeSet()}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  {createProperty.isPending || saveConsumptionRules.isPending ? 'Creando...' : 'Crear Propiedad'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
