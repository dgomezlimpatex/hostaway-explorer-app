import { BaseEntity } from './common';

// Enums para los tipos de la base de datos
export type InventoryMovementType = 'entrada' | 'salida' | 'ajuste' | 'consumo_automatico';
export type InventoryAlertType = 'stock_bajo' | 'stock_critico';

// Interfaces para las entidades del inventario

export interface InventoryCategory extends BaseEntity {
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
}

export interface InventoryProduct extends BaseEntity {
  category_id: string;
  name: string;
  description?: string;
  unit_of_measure: string;
  is_active: boolean;
  sort_order: number;
  // Relación con categoría
  category?: InventoryCategory;
}

export interface InventoryStock {
  id: string;
  product_id: string;
  current_quantity: number;
  minimum_stock: number;
  maximum_stock: number;
  cost_per_unit?: number;
  last_updated: string;
  updated_by: string;
  // Relaciones
  product?: InventoryProduct;
}

export interface PropertyConsumptionConfig extends BaseEntity {
  property_id: string;
  product_id: string;
  quantity_per_cleaning: number;
  is_active: boolean;
  // Relaciones
  product?: InventoryProduct;
  property?: any; // Referencia a Property
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  task_id?: string;
  property_id?: string;
  created_by: string;
  created_at: string;
  // Relaciones
  product?: InventoryProduct;
  task?: any; // Referencia a Task
  property?: any; // Referencia a Property
}

export interface InventoryAlert {
  id: string;
  product_id: string;
  alert_type: InventoryAlertType;
  triggered_at: string;
  resolved_at?: string;
  is_active: boolean;
  notified_users: any; // JSONB array from Supabase
  // Relaciones
  product?: InventoryProduct;
}

// DTOs para la creación de entidades

export interface CreateInventoryCategoryData {
  name: string;
  description?: string;
  sort_order?: number;
}

export interface CreateInventoryProductData {
  category_id: string;
  name: string;
  description?: string;
  unit_of_measure?: string;
  sort_order?: number;
  sede_id: string;
}

export interface CreateInventoryStockData {
  product_id: string;
  current_quantity: number;
  minimum_stock: number;
  maximum_stock: number;
  cost_per_unit?: number;
  sede_id: string;
}

export interface UpdateInventoryStockData {
  current_quantity?: number;
  minimum_stock?: number;
  maximum_stock?: number;
  cost_per_unit?: number;
}

export interface CreatePropertyConsumptionConfigData {
  property_id: string;
  product_id: string;
  quantity_per_cleaning: number;
}

export interface CreateInventoryMovementData {
  product_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  reason: string;
  task_id?: string;
  property_id?: string;
}

export interface CreateInventoryAlertData {
  product_id: string;
  alert_type: InventoryAlertType;
}

// Interfaces para vistas combinadas

export interface InventoryStockWithProduct extends InventoryStock {
  product: InventoryProduct & {
    category: InventoryCategory;
  };
}

export interface InventoryMovementWithDetails extends InventoryMovement {
  product: InventoryProduct & {
    category: InventoryCategory;
  };
}

export interface PropertyConsumptionWithDetails extends PropertyConsumptionConfig {
  product: InventoryProduct & {
    category: InventoryCategory;
  };
}

// Interfaces para dashboard y reportes

export interface InventoryDashboardStats {
  total_products: number;
  low_stock_alerts: number;
  critical_alerts: number;
  total_movements_today: number;
  total_stock_value?: number;
}

export interface InventoryPrediction {
  product_id: string;
  product_name: string;
  current_stock: number;
  daily_consumption_avg: number;
  days_until_depletion: number;
  suggested_order_quantity: number;
  next_tasks_consumption: number;
}

export interface InventoryReport {
  period: string;
  product_consumption: Array<{
    product_id: string;
    product_name: string;
    total_consumed: number;
    consumption_by_property: Array<{
      property_id: string;
      property_name: string;
      quantity: number;
    }>;
  }>;
  stock_movements: Array<{
    movement_type: InventoryMovementType;
    total_quantity: number;
    count: number;
  }>;
}

// Interfaces para formularios

export interface StockAdjustmentForm {
  product_id: string;
  adjustment_type: 'entrada' | 'salida' | 'ajuste';
  quantity: number;
  reason: string;
  cost_per_unit?: number;
}

export interface BulkStockUpdateForm {
  updates: Array<{
    product_id: string;
    current_quantity: number;
    minimum_stock: number;
    maximum_stock: number;
  }>;
}

export interface ConsumptionConfigForm {
  property_id: string;
  products: Array<{
    product_id: string;
    quantity_per_cleaning: number;
  }>;
}