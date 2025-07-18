import { useConsumptionConfig } from '@/hooks/useConsumptionConfig';
import { ConsumptionConfigTable } from '@/components/inventory/ConsumptionConfigTable';
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';

export default function InventoryConfig() {
  const { consumptionConfigs, isLoading } = useConsumptionConfig();

  const handleConfigCreated = () => {
    // La tabla se actualizará automáticamente por React Query
  };

  const handleConfigEdited = () => {
    // La tabla se actualizará automáticamente por React Query
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuración de Inventario</h1>
          <p className="text-muted-foreground">
            Configuración de consumos automáticos por propiedad
          </p>
        </div>

        <ConsumptionConfigTable
          configs={consumptionConfigs || []}
          onCreateConfig={handleConfigCreated}
          onEditConfig={handleConfigEdited}
        />
      </div>
      
      <RoleBasedNavigation />
    </div>
  );
}