import { InventoryLayout } from '@/components/inventory/InventoryLayout';
import { AmenityMappingTable } from '@/components/inventory/AmenityMappingTable';

export default function InventoryConfig() {
  return (
    <InventoryLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuración de Inventario</h1>
          <p className="text-muted-foreground">
            Configuración automática de consumo basado en amenities de propiedades
          </p>
        </div>

        <AmenityMappingTable />
      </div>
    </InventoryLayout>
  );
}