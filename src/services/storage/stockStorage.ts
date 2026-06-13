import { supabase } from '@/integrations/supabase/client';
import { recordAiObservedEvent } from '@/services/aiObservedEvents';
import type {
  CreateStockCategoryData,
  CreateStockProductData,
  CreateStockWarehouseData,
  StockAdjustmentData,
  StockCategory,
  StockDashboardStats,
  StockItemKind,
  StockLevel,
  StockMovement,
  StockProduct,
  StockPropertyConsumptionRule,
  StockTransferData,
  StockWarehouse,
  SaveStockPropertyConsumptionRuleData,
  StockLevelSettingsData,
  StockSedeSettings,
  UpdateStockCategoryData,
  UpdateStockProductData,
  UpdateStockSedeSettingsData,
} from '@/types/stock';

const db = supabase;
type StockDbRow = Record<string, unknown>;

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
};

const normalizeStockLevel = (level: StockDbRow): StockLevel => ({
  ...level,
  current_quantity: toNumber(level.current_quantity),
  minimum_quantity: toNumber(level.minimum_quantity),
  target_quantity: toNumber(level.target_quantity),
  cost_per_unit: level.cost_per_unit == null ? null : toNumber(level.cost_per_unit),
} as StockLevel);

class StockStorageService {
  async getWarehouses(sedeId: string): Promise<StockWarehouse[]> {
    const { data, error } = await db
      .from('stock_warehouses')
      .select('*')
      .eq('sede_id', sedeId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('sort_order')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async getSedeSettings(sedeId: string): Promise<StockSedeSettings> {
    const { data, error } = await db
      .from('stock_sede_settings')
      .select('*')
      .eq('sede_id', sedeId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { data: created, error: createError } = await db
      .from('stock_sede_settings')
      .insert({ sede_id: sedeId })
      .select()
      .single();

    if (createError) throw createError;
    return created;
  }

  async updateSedeSettings(
    sedeId: string,
    updates: UpdateStockSedeSettingsData
  ): Promise<StockSedeSettings> {
    const { data, error } = await db
      .from('stock_sede_settings')
      .upsert({
        sede_id: sedeId,
        ...updates,
      }, { onConflict: 'sede_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createWarehouse(input: CreateStockWarehouseData): Promise<StockWarehouse> {
    const { data, error } = await db.rpc('create_stock_warehouse', {
      sede_id_param: input.sede_id,
      name_param: input.name.trim(),
      address_param: input.address || null,
      is_default_param: input.is_default ?? false,
      sort_order_param: input.sort_order ?? 0,
    });

    if (error) throw error;
    void recordAiObservedEvent({
      eventType: 'stock_warehouse_created',
      entityType: 'stock_warehouse',
      entityId: data.id,
      sedeId: data.sede_id,
      summary: `Almacen de stock creado: ${data.name}`,
      afterData: data as unknown as Record<string, unknown>,
    });
    return data;
  }

  async updateWarehouse(id: string, updates: Partial<StockWarehouse>): Promise<StockWarehouse> {
    const { data: beforeWarehouse } = await db
      .from('stock_warehouses')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const { is_default: isDefault, ...warehouseUpdates } = updates;
    let updatedWarehouse: StockWarehouse | null = null;

    if (isDefault) {
      const { data, error } = await db.rpc('set_default_stock_warehouse', {
        warehouse_id_param: id,
      });

      if (error) throw error;
      updatedWarehouse = data;
    }

    if (Object.keys(warehouseUpdates).length === 0) {
      void recordAiObservedEvent({
        eventType: 'stock_warehouse_updated',
        entityType: 'stock_warehouse',
        entityId: updatedWarehouse!.id,
        sedeId: updatedWarehouse!.sede_id,
        summary: `Almacen de stock actualizado: ${updatedWarehouse!.name}`,
        beforeData: beforeWarehouse as Record<string, unknown> | null,
        afterData: updatedWarehouse as unknown as Record<string, unknown>,
      });
      return updatedWarehouse!;
    }

    const { data, error } = await db
      .from('stock_warehouses')
      .update(warehouseUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    void recordAiObservedEvent({
      eventType: 'stock_warehouse_updated',
      entityType: 'stock_warehouse',
      entityId: data.id,
      sedeId: data.sede_id,
      summary: `Almacen de stock actualizado: ${data.name}`,
      beforeData: beforeWarehouse as Record<string, unknown> | null,
      afterData: data as unknown as Record<string, unknown>,
    });
    return data;
  }

  async deleteWarehouse(id: string): Promise<void> {
    const { data: warehouse, error: warehouseError } = await db
      .from('stock_warehouses')
      .select('id, is_default')
      .eq('id', id)
      .single();

    if (warehouseError) throw warehouseError;
    if (warehouse?.is_default) {
      throw new Error('No se puede eliminar el almacen principal. Marca otro almacen como principal primero.');
    }

    const { error } = await db
      .from('stock_warehouses')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    void recordAiObservedEvent({
      eventType: 'stock_warehouse_deleted',
      entityType: 'stock_warehouse',
      entityId: id,
      summary: `Almacen de stock desactivado: ${id}`,
      beforeData: warehouse as Record<string, unknown>,
    });
  }

  async getCategories(kind?: StockItemKind): Promise<StockCategory[]> {
    let query = db
      .from('stock_categories')
      .select('*')
      .eq('is_active', true)
      .order('kind')
      .order('sort_order')
      .order('name');

    if (kind) query = query.eq('kind', kind);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createCategory(input: CreateStockCategoryData): Promise<StockCategory> {
    const { data, error } = await db
      .from('stock_categories')
      .insert({
        kind: input.kind,
        name: input.name.trim(),
        description: input.description || null,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCategory(id: string, updates: UpdateStockCategoryData): Promise<StockCategory> {
    const payload: UpdateStockCategoryData = { ...updates };
    if (payload.name != null) payload.name = payload.name.trim();
    if (payload.description != null) payload.description = payload.description.trim() || null;

    const { data, error } = await db
      .from('stock_categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCategory(id: string): Promise<void> {
    const { count, error: countError } = await db
      .from('stock_products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
      .eq('is_active', true);

    if (countError) throw countError;
    if ((count || 0) > 0) {
      throw new Error('No se puede borrar un tipo con productos activos asignados. Reasigna esos productos primero.');
    }

    const { error } = await db
      .from('stock_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getProducts(sedeId: string, kind?: StockItemKind): Promise<StockProduct[]> {
    const { data, error } = await db
      .from('stock_products')
      .select('*, category:stock_categories(*)')
      .eq('sede_id', sedeId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (error) throw error;
    const products = data || [];
    return kind ? products.filter((product: StockProduct) => product.category?.kind === kind) : products;
  }

  async getStockLevels(params: {
    sedeId: string;
    warehouseId?: string;
    kind?: StockItemKind;
  }): Promise<StockLevel[]> {
    let query = db
      .from('stock_levels')
      .select(`
        *,
        product:stock_products!inner(
          *,
          category:stock_categories(*)
        ),
        warehouse:stock_warehouses!inner(*)
      `)
      .eq('product.sede_id', params.sedeId)
      .eq('product.is_active', true)
      .eq('warehouse.is_active', true)
      .order('last_updated', { ascending: false });

    if (params.warehouseId) {
      query = query.eq('warehouse_id', params.warehouseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const levels = (data || []).map(normalizeStockLevel);
    return params.kind
      ? levels.filter((level) => level.product?.category?.kind === params.kind)
      : levels;
  }

  async createProduct(input: CreateStockProductData): Promise<void> {
    const { data: product, error: productError } = await db
      .from('stock_products')
      .insert({
        sede_id: input.sede_id,
        category_id: input.category_id,
        name: input.name.trim(),
        description: input.description || null,
        unit_of_measure: input.unit_of_measure.trim() || 'unidades',
        sku: input.sku || null,
        is_consumable: input.is_consumable ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .select()
      .single();

    if (productError) throw productError;

    let warehouseId = input.warehouse_id;
    if (!warehouseId) {
      const { data: defaultWarehouse, error: warehouseError } = await db
        .from('stock_warehouses')
        .select('id')
        .eq('sede_id', input.sede_id)
        .eq('is_default', true)
        .single();

      if (warehouseError) throw warehouseError;
      warehouseId = defaultWarehouse.id;
    }

    const { data: warehouses, error: warehousesError } = await db
      .from('stock_warehouses')
      .select('id')
      .eq('sede_id', input.sede_id)
      .eq('is_active', true);

    if (warehousesError) throw warehousesError;
    if (!warehouses?.length) throw new Error('No hay almacenes activos para crear el stock inicial.');

    const stockLevels = warehouses.map((warehouse: { id: string }) => ({
      product_id: product.id,
      warehouse_id: warehouse.id,
      current_quantity: warehouse.id === warehouseId ? input.initial_quantity ?? 0 : 0,
      minimum_quantity: input.minimum_quantity ?? 0,
      target_quantity: input.target_quantity ?? 0,
      cost_per_unit: input.cost_per_unit ?? null,
    }));

    const { error: levelError } = await db.from('stock_levels').insert(stockLevels);

    if (levelError) throw levelError;
    void recordAiObservedEvent({
      eventType: 'stock_product_created',
      entityType: 'stock_product',
      entityId: product.id,
      sedeId: product.sede_id,
      summary: `Producto de stock creado: ${product.name}`,
      afterData: {
        product,
        initial_quantity: input.initial_quantity ?? 0,
        warehouse_id: warehouseId,
        minimum_quantity: input.minimum_quantity ?? 0,
        target_quantity: input.target_quantity ?? 0,
        cost_per_unit: input.cost_per_unit ?? null,
      },
    });
  }

  async updateProduct(id: string, updates: UpdateStockProductData): Promise<StockProduct> {
    const { data: beforeProduct } = await db
      .from('stock_products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const payload: UpdateStockProductData = { ...updates };
    if (payload.name != null) payload.name = payload.name.trim();
    if (payload.description != null) payload.description = payload.description.trim() || null;
    if (payload.unit_of_measure != null) payload.unit_of_measure = payload.unit_of_measure.trim() || 'unidades';
    if (payload.sku != null) payload.sku = payload.sku.trim() || null;

    const { data, error } = await db
      .from('stock_products')
      .update(payload)
      .eq('id', id)
      .select('*, category:stock_categories(*)')
      .single();

    if (error) throw error;
    void recordAiObservedEvent({
      eventType: 'stock_product_updated',
      entityType: 'stock_product',
      entityId: data.id,
      sedeId: data.sede_id,
      summary: `Producto de stock actualizado: ${data.name}`,
      beforeData: beforeProduct as Record<string, unknown> | null,
      afterData: data as unknown as Record<string, unknown>,
    });
    return data;
  }

  async deleteProduct(id: string): Promise<void> {
    const { data: beforeProduct } = await db
      .from('stock_products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const { error } = await db
      .from('stock_products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    void recordAiObservedEvent({
      eventType: 'stock_product_deleted',
      entityType: 'stock_product',
      entityId: id,
      sedeId: beforeProduct?.sede_id || null,
      summary: `Producto de stock desactivado: ${beforeProduct?.name || id}`,
      beforeData: beforeProduct as Record<string, unknown> | null,
    });
  }

  async getPropertyConsumptionRules(propertyId: string): Promise<StockPropertyConsumptionRule[]> {
    const { data, error } = await db
      .from('stock_property_consumption_rules')
      .select(`
        *,
        product:stock_products(
          *,
          category:stock_categories(*)
        ),
        warehouse:stock_warehouses(*)
      `)
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((rule: StockDbRow) => ({
      ...rule,
      quantity_per_cleaning: toNumber(rule.quantity_per_cleaning),
    } as StockPropertyConsumptionRule));
  }

  async getSedeConsumptionRules(sedeId: string): Promise<StockPropertyConsumptionRule[]> {
    const { data, error } = await db
      .from('stock_property_consumption_rules')
      .select(`
        *,
        property:properties!inner(id, codigo, nombre, is_active, sede_id),
        product:stock_products(
          *,
          category:stock_categories(*)
        ),
        warehouse:stock_warehouses(*)
      `)
      .eq('property.sede_id', sedeId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((rule: StockDbRow) => ({
      ...rule,
      quantity_per_cleaning: toNumber(rule.quantity_per_cleaning),
    } as StockPropertyConsumptionRule));
  }

  async savePropertyConsumptionRules(
    propertyId: string,
    rules: SaveStockPropertyConsumptionRuleData[]
  ): Promise<void> {
    const normalizedRules = rules.map((rule) => ({
      property_id: propertyId,
      product_id: rule.product_id,
      warehouse_id: rule.warehouse_id || null,
      quantity_per_cleaning: Math.max(0, Number(rule.quantity_per_cleaning) || 0),
      notes: rule.notes || null,
      is_active: true,
    }));

    if (normalizedRules.length === 0) return;

    const { error } = await db
      .from('stock_property_consumption_rules')
      .upsert(normalizedRules, { onConflict: 'property_id,product_id' });

    if (error) throw error;
    void recordAiObservedEvent({
      eventType: 'stock_consumption_rules_updated',
      entityType: 'property',
      entityId: propertyId,
      summary: `Reglas de consumo actualizadas para propiedad ${propertyId}`,
      afterData: { rules: normalizedRules },
      metadata: { rules_count: normalizedRules.length },
    });
  }

  async adjustStock(input: StockAdjustmentData): Promise<void> {
    const currentQuantity = input.stock_level.current_quantity;
    let newQuantity = currentQuantity;

    if (input.movement_type === 'entrada') {
      newQuantity = currentQuantity + input.quantity;
    } else if (input.movement_type === 'salida') {
      newQuantity = currentQuantity - input.quantity;
      if (newQuantity < 0) {
        throw new Error('No hay stock suficiente para realizar la salida.');
      }
    } else {
      newQuantity = input.quantity;
    }

    const movementQuantity = input.movement_type === 'ajuste'
      ? Math.abs(newQuantity - currentQuantity)
      : input.quantity;

    if (movementQuantity <= 0) {
      throw new Error('La cantidad debe producir un cambio de stock.');
    }

    const { error: updateError } = await db
      .from('stock_levels')
      .update({
        current_quantity: newQuantity,
        updated_by: input.user_id,
        ...(input.cost_per_unit != null ? { cost_per_unit: input.cost_per_unit } : {}),
      })
      .eq('id', input.stock_level.id);

    if (updateError) throw updateError;

    const { error: movementError } = await db.from('stock_movements').insert({
      product_id: input.stock_level.product_id,
      warehouse_id: input.stock_level.warehouse_id,
      movement_type: input.movement_type,
      quantity: movementQuantity,
      previous_quantity: currentQuantity,
      new_quantity: newQuantity,
      reason: input.reason.trim(),
      created_by: input.user_id,
    });

    if (movementError) throw movementError;
    void recordAiObservedEvent({
      eventType: 'stock_adjusted',
      entityType: 'stock_level',
      entityId: input.stock_level.id,
      summary: `Stock ${input.movement_type}: ${movementQuantity} unidades`,
      beforeData: {
        product_id: input.stock_level.product_id,
        warehouse_id: input.stock_level.warehouse_id,
        current_quantity: currentQuantity,
      },
      afterData: {
        product_id: input.stock_level.product_id,
        warehouse_id: input.stock_level.warehouse_id,
        current_quantity: newQuantity,
        movement_type: input.movement_type,
        reason: input.reason,
      },
    });
  }

  async updateStockLevelSettings(input: StockLevelSettingsData): Promise<StockLevel> {
    const { data, error } = await db.rpc('update_stock_level_settings', {
      stock_level_id_param: input.stock_level_id,
      minimum_quantity_param: input.minimum_quantity,
      target_quantity_param: input.target_quantity,
      cost_per_unit_param: input.cost_per_unit ?? null,
      user_id_param: input.user_id,
    });

    if (error) throw error;
    const normalized = normalizeStockLevel(data);
    void recordAiObservedEvent({
      eventType: 'stock_level_settings_updated',
      entityType: 'stock_level',
      entityId: input.stock_level_id,
      summary: `Parametros de stock actualizados: minimo ${input.minimum_quantity}, objetivo ${input.target_quantity}`,
      afterData: normalized as unknown as Record<string, unknown>,
    });
    return normalized;
  }

  async transferStock(input: StockTransferData): Promise<void> {
    const { error } = await db.rpc('transfer_stock_between_warehouses', {
      product_id_param: input.stock_level.product_id,
      from_warehouse_id_param: input.stock_level.warehouse_id,
      to_warehouse_id_param: input.to_warehouse_id,
      quantity_param: input.quantity,
      reason_param: input.reason.trim(),
      user_id_param: input.user_id,
    });

    if (error) throw error;
    void recordAiObservedEvent({
      eventType: 'stock_transferred',
      entityType: 'stock_level',
      entityId: input.stock_level.id,
      summary: `Transferencia de stock: ${input.quantity} unidades`,
      afterData: {
        product_id: input.stock_level.product_id,
        from_warehouse_id: input.stock_level.warehouse_id,
        to_warehouse_id: input.to_warehouse_id,
        quantity: input.quantity,
        reason: input.reason,
      },
    });
  }

  async getMovements(sedeId: string, limit = 100): Promise<StockMovement[]> {
    const { data, error } = await db
      .from('stock_movements')
      .select(`
        *,
        product:stock_products!inner(
          *,
          category:stock_categories(*)
        ),
        warehouse:stock_warehouses!stock_movements_warehouse_id_fkey(*),
        to_warehouse:stock_warehouses!stock_movements_to_warehouse_id_fkey(*)
      `)
      .eq('product.sede_id', sedeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((movement: StockDbRow) => ({
      ...movement,
      quantity: toNumber(movement.quantity),
      previous_quantity: toNumber(movement.previous_quantity),
      new_quantity: toNumber(movement.new_quantity),
      to_previous_quantity: movement.to_previous_quantity == null ? null : toNumber(movement.to_previous_quantity),
      to_new_quantity: movement.to_new_quantity == null ? null : toNumber(movement.to_new_quantity),
    } as StockMovement));
  }

  getDashboardStats(levels: StockLevel[], warehouses: StockWarehouse[]): StockDashboardStats {
    const uniqueProducts = new Set(levels.map((level) => level.product_id));
    const lowStock = levels.filter((level) => level.current_quantity > 0 && level.current_quantity <= level.minimum_quantity).length;
    const criticalStock = levels.filter((level) => level.current_quantity <= 0).length;
    const totalUnits = levels.reduce((sum, level) => sum + level.current_quantity, 0);
    const totalValue = levels.reduce(
      (sum, level) => sum + level.current_quantity * (level.cost_per_unit || 0),
      0
    );

    return {
      totalProducts: uniqueProducts.size,
      totalWarehouses: warehouses.length,
      lowStock,
      criticalStock,
      totalUnits,
      totalValue,
    };
  }
}

export const stockStorage = new StockStorageService();
