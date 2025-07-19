import { useState } from 'react';
import { Package } from 'lucide-react';
import { useInventoryStock } from '@/hooks/useInventory';
import { InventoryLayout } from '@/components/inventory/InventoryLayout';
import { InventoryStockTable } from '@/components/inventory/InventoryStockTable';
import { CreateProductDialog } from '@/components/inventory/CreateProductDialog';
import { StockAdjustmentDialog } from '@/components/inventory/StockAdjustmentDialog';
import type { InventoryStockWithProduct } from '@/types/inventory';

export default function InventoryStock() {
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showStockAdjustment, setShowStockAdjustment] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<InventoryStockWithProduct | null>(null);

  const { data: stock = [], isLoading } = useInventoryStock();

  const handleEditStock = (stockItem: InventoryStockWithProduct) => {
    setSelectedStockItem(stockItem);
    setShowStockAdjustment(true);
  };

  const handleAdjustStock = (stockItem: InventoryStockWithProduct) => {
    setSelectedStockItem(stockItem);
    setShowStockAdjustment(true);
  };

  const handleCreateProduct = () => {
    setShowCreateProduct(true);
  };

  return (
    <InventoryLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Stock de Inventario</h1>
        </div>
        
        <InventoryStockTable
          stock={stock}
          isLoading={isLoading}
          onEditStock={handleEditStock}
          onCreateProduct={handleCreateProduct}
          onAdjustStock={handleAdjustStock}
        />

        <CreateProductDialog
          open={showCreateProduct}
          onOpenChange={setShowCreateProduct}
        />

        <StockAdjustmentDialog
          open={showStockAdjustment}
          onOpenChange={setShowStockAdjustment}
          stockItem={selectedStockItem}
        />
      </div>
    </InventoryLayout>
  );
}