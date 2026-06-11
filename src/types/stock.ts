export type StockItemKind = 'laundry' | 'amenity' | 'other';
export type StockMovementType = 'entrada' | 'salida' | 'ajuste' | 'consumo_automatico' | 'transferencia';
export type StockAlertType = 'stock_bajo' | 'stock_critico';

export interface StockWarehouse {
  id: string;
  sede_id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StockCategory {
  id: string;
  kind: StockItemKind;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StockProduct {
  id: string;
  sede_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  unit_of_measure: string;
  sku: string | null;
  is_consumable: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: StockCategory | null;
}

export interface StockLevel {
  id: string;
  product_id: string;
  warehouse_id: string;
  current_quantity: number;
  minimum_quantity: number;
  target_quantity: number;
  cost_per_unit: number | null;
  last_updated: string;
  updated_by: string | null;
  product?: StockProduct | null;
  warehouse?: StockWarehouse | null;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  to_warehouse_id: string | null;
  movement_type: StockMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  to_previous_quantity: number | null;
  to_new_quantity: number | null;
  reason: string;
  task_id: string | null;
  property_id: string | null;
  created_by: string | null;
  created_at: string;
  product?: StockProduct | null;
  warehouse?: StockWarehouse | null;
  to_warehouse?: StockWarehouse | null;
}

export interface StockPropertyConsumptionRule {
  id: string;
  property_id: string;
  product_id: string;
  warehouse_id: string | null;
  quantity_per_cleaning: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product?: StockProduct | null;
  warehouse?: StockWarehouse | null;
  property?: {
    id: string;
    codigo: string | null;
    nombre: string | null;
    is_active: boolean | null;
  } | null;
}

export interface StockSedeSettings {
  sede_id: string;
  auto_consumption_enabled: boolean;
  preparation_mode: boolean;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveStockPropertyConsumptionRuleData {
  product_id: string;
  quantity_per_cleaning: number;
  warehouse_id?: string | null;
  notes?: string | null;
}

export interface StockDashboardStats {
  totalProducts: number;
  totalWarehouses: number;
  lowStock: number;
  criticalStock: number;
  totalUnits: number;
  totalValue: number;
}

export interface CreateStockWarehouseData {
  sede_id: string;
  name: string;
  address?: string | null;
  is_default?: boolean;
  sort_order?: number;
}

export interface CreateStockProductData {
  sede_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  unit_of_measure: string;
  sku?: string | null;
  is_consumable?: boolean;
  sort_order?: number;
  warehouse_id?: string;
  initial_quantity?: number;
  minimum_quantity?: number;
  target_quantity?: number;
  cost_per_unit?: number | null;
}

export interface CreateStockCategoryData {
  kind: StockItemKind;
  name: string;
  description?: string | null;
  sort_order?: number;
}

export interface UpdateStockCategoryData {
  name?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateStockProductData {
  category_id?: string;
  name?: string;
  description?: string | null;
  unit_of_measure?: string;
  sku?: string | null;
  is_consumable?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface StockAdjustmentData {
  stock_level: StockLevel;
  movement_type: Extract<StockMovementType, 'entrada' | 'salida' | 'ajuste'>;
  quantity: number;
  reason: string;
  user_id: string;
  cost_per_unit?: number | null;
}

export interface StockTransferData {
  stock_level: StockLevel;
  to_warehouse_id: string;
  quantity: number;
  reason: string;
  user_id: string;
}

export interface StockLevelSettingsData {
  stock_level_id: string;
  minimum_quantity: number;
  target_quantity: number;
  cost_per_unit?: number | null;
  user_id: string;
}

export interface UpdateStockSedeSettingsData {
  auto_consumption_enabled?: boolean;
  preparation_mode?: boolean;
  notes?: string | null;
  updated_by?: string | null;
}
