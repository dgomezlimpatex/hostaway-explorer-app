
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
import { StockConsumptionSection } from './forms/StockConsumptionSection';
import { PropertyPreferredCleaners } from './PropertyPreferredCleaners';
import { NotesSection } from './forms/NotesSection';
import { ClientSelectionSection } from './forms/ClientSelectionSection';
import { useSavePropertyStockConsumptionRules, useStockProducts } from '@/hooks/useStock';
import { applyDefaultPropertyConsumptionsToForm, deriveLegacyStockFields } from './forms/propertyStockConsumption';
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
  const saveConsumptionRules = useSavePropertyStockConsumptionRules();
  const { data: stockProducts = [] } = useStockProducts();

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: property ? {
      codigo: property.codigo,
      nombre: property.nombre,
      direccion: property.direccion,
      numeroCamas: property.numeroCamas,
      numeroCamasPequenas: property.numeroCamasPequenas || 0,
      numeroCamasSuite: property.numeroCamasSuite || 0,
      numeroSofasCama: property.numeroSofasCama || 0,
      numeroBanos: property.numeroBanos,
      numeroCocinas: property.numeroCocinas ?? 1,
      duracionServicio: property.duracionServicio,
      costeServicio: property.costeServicio,
      checkInPredeterminado: property.checkInPredeterminado,
      checkOutPredeterminado: property.checkOutPredeterminado,
      numeroSabanas: property.numeroSabanas,
      numeroSabanasRequenas: property.numeroSabanasRequenas || 0,
      numeroSabanasSuite: property.numeroSabanasSuite || 0,
      numeroToallasGrandes: property.numeroToallasGrandes,
      numeroTotallasPequenas: property.numeroTotallasPequenas,
      numeroAlfombrines: property.numeroAlfombrines,
        numeroFundasAlmohada: property.numeroFundasAlmohada,
        kitAlimentario: property.kitAlimentario || 0,
        amenitiesBano: property.amenitiesBano || 0,
        amenitiesCocina: property.amenitiesCocina || 0,
        cantidadRollosPapelHigienico: property.cantidadRollosPapelHigienico || 0,
        cantidadRollosPapelCocina: property.cantidadRollosPapelCocina || 0,
        bayetasCocina: property.bayetasCocina || 0,
        bolsasBasura: property.bolsasBasura || 0,
        stockConsumptions: {},
        notas: property.notas || '',
        clienteId: property.clienteId,
        linenControlEnabled: property.linenControlEnabled ?? null,
        isActive: property.isActive ?? null,
        excludeFromExport: property.excludeFromExport ?? false,
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
        numeroCamasPequenas: property.numeroCamasPequenas || 0,
        numeroCamasSuite: property.numeroCamasSuite || 0,
        numeroSofasCama: property.numeroSofasCama || 0,
        numeroBanos: property.numeroBanos,
        numeroCocinas: property.numeroCocinas ?? 1,
        duracionServicio: property.duracionServicio,
        costeServicio: property.costeServicio,
        checkInPredeterminado: property.checkInPredeterminado,
        checkOutPredeterminado: property.checkOutPredeterminado,
        numeroSabanas: property.numeroSabanas,
        numeroSabanasRequenas: property.numeroSabanasRequenas || 0,
        numeroSabanasSuite: property.numeroSabanasSuite || 0,
        numeroToallasGrandes: property.numeroToallasGrandes,
        numeroTotallasPequenas: property.numeroTotallasPequenas,
        numeroAlfombrines: property.numeroAlfombrines,
        numeroFundasAlmohada: property.numeroFundasAlmohada,
        kitAlimentario: property.kitAlimentario || 0,
        amenitiesBano: property.amenitiesBano || 0,
        amenitiesCocina: property.amenitiesCocina || 0,
        cantidadRollosPapelHigienico: property.cantidadRollosPapelHigienico || 0,
        cantidadRollosPapelCocina: property.cantidadRollosPapelCocina || 0,
        bayetasCocina: property.bayetasCocina || 0,
        bolsasBasura: property.bolsasBasura || 0,
        stockConsumptions: {},
        notas: property.notas || '',
        clienteId: property.clienteId,
        linenControlEnabled: property.linenControlEnabled ?? null,
        isActive: property.isActive ?? null,
        excludeFromExport: property.excludeFromExport ?? false,
      });
    }
  }, [property, form]);

  const onSubmit = async (data: PropertyFormData) => {
    if (!property) return;

    try {
      const stockConsumptions = data.stockConsumptions || {};
      const legacyStockFields = deriveLegacyStockFields(stockProducts, stockConsumptions);
      await updateProperty.mutateAsync({
        id: property.id,
        updates: {
          ...data,
          ...legacyStockFields,
        }
      });
      await saveConsumptionRules.mutateAsync({
        propertyId: property.id,
        rules: stockProducts.map((product) => ({
          product_id: product.id,
          quantity_per_cleaning: stockConsumptions[product.id] || 0,
        })),
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating property:', error);
    }
  };

  const handleApplyAutomaticConsumptions = () => {
    const values = form.getValues();
    applyDefaultPropertyConsumptionsToForm(form.setValue, stockProducts, {
      numeroCamas: values.numeroCamas || 0,
      numeroCamasPequenas: values.numeroCamasPequenas || 0,
      numeroCamasSuite: values.numeroCamasSuite || 0,
      numeroBanos: values.numeroBanos || 0,
      numeroCocinas: values.numeroCocinas || 0,
    });
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

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-blue-900">Calculo automatico de consumos</p>
                  <p className="text-sm text-blue-700">
                    Recalcula sabanas, toallas, amenities y consumibles desde camas, banos y cocinas.
                    Puedes ajustar cualquier cantidad despues.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleApplyAutomaticConsumptions}>
                  Recalcular consumos
                </Button>
              </div>
            </div>
            
            <StockConsumptionSection control={form.control} setValue={form.setValue} property={property} />
            
            <NotesSection control={form.control} />
            
            <ClientSelectionSection control={form.control} />

            <PropertyPreferredCleaners propertyId={property.id} />

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
                disabled={updateProperty.isPending || saveConsumptionRules.isPending}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateProperty.isPending || saveConsumptionRules.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
