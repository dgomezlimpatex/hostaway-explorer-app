import { useState } from 'react';
import { StockAdjustmentDialog } from '@/components/stock/StockAdjustmentDialog';
import { StockCategoryManager } from '@/components/stock/StockCategoryManager';
import { StockLayout } from '@/components/stock/StockLayout';
import { StockLevelTable } from '@/components/stock/StockLevelTable';
import { StockProductDialog } from '@/components/stock/StockProductDialog';
import { StockTransferDialog } from '@/components/stock/StockTransferDialog';
import { useSelectedStockWarehouse, useStockLevels } from '@/hooks/useStock';
import type { StockItemKind, StockLevel, StockProduct } from '@/types/stock';

interface InventoryStockProps {
  kind?: StockItemKind;
  title?: string;
  description?: string;
}

export default function InventoryStock({
  kind,
  title = 'Stock global',
  description = 'Consulta y ajusta stock por producto y almacen.',
}: InventoryStockProps) {
  const { queryWarehouseId } = useSelectedStockWarehouse();
  const { data: levels = [], isLoading } = useStockLevels(queryWarehouseId, kind);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<StockLevel | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(null);

  const handleAdjustStock = (level: StockLevel) => {
    setSelectedLevel(level);
    setAdjustmentDialogOpen(true);
  };

  const handleTransferStock = (level: StockLevel) => {
    setSelectedLevel(level);
    setTransferDialogOpen(true);
  };

  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setProductDialogOpen(true);
  };

  const handleEditProduct = (level: StockLevel) => {
    if (!level.product) return;
    setSelectedProduct(level.product);
    setProductDialogOpen(true);
  };

  return (
    <StockLayout
      title={title}
      description={description}
      actions={kind ? <StockCategoryManager kind={kind} /> : undefined}
    >
      <StockLevelTable
        levels={levels}
        isLoading={isLoading}
        onCreateProduct={handleCreateProduct}
        onEditProduct={handleEditProduct}
        onAdjustStock={handleAdjustStock}
        onTransferStock={handleTransferStock}
      />

      <StockProductDialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setSelectedProduct(null);
        }}
        kind={kind}
        product={selectedProduct}
      />

      <StockAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        level={selectedLevel}
      />

      <StockTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        level={selectedLevel}
      />
    </StockLayout>
  );
}
