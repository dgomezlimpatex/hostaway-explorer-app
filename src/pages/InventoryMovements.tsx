import { useMovements } from '@/hooks/useMovements';
import { MovementsTable } from '@/components/inventory/MovementsTable';
import { InventoryLayout } from '@/components/inventory/InventoryLayout';

export default function InventoryMovements() {
  const { movements, isLoading } = useMovements();

  const handleMovementCreated = () => {
    // La tabla se actualizará automáticamente por React Query
  };

  if (isLoading) {
    return (
      <InventoryLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando movimientos...</p>
          </div>
        </div>
      </InventoryLayout>
    );
  }

  return (
    <InventoryLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Movimientos de Inventario</h1>
          <p className="text-muted-foreground">
            Historial completo de entradas, salidas y ajustes de inventario
          </p>
        </div>

        <MovementsTable
          movements={movements || []}
          onCreateMovement={handleMovementCreated}
        />
      </div>
    </InventoryLayout>
  );
}