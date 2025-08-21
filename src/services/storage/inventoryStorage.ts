import { supabase } from '@/integrations/supabase/client';
import {
  InventoryCategory,
  InventoryProduct,
  InventoryStock,
  PropertyConsumptionConfig,
  InventoryMovement,
  InventoryAlert,
  CreateInventoryCategoryData,
  CreateInventoryProductData,
  CreateInventoryStockData,
  UpdateInventoryStockData,
  CreatePropertyConsumptionConfigData,
  CreateInventoryMovementData,
  CreateInventoryAlertData,
  InventoryStockWithProduct,
  InventoryMovementWithDetails,
  PropertyConsumptionWithDetails,
  InventoryDashboardStats
} from '@/types/inventory';

class InventoryStorageService {
  // Función helper para obtener la sede activa
  private getActiveSedeId(): string | null {
    try {
      const activeSede = localStorage.getItem('activeSede');
      if (activeSede) {
        const sede = JSON.parse(activeSede);
        return sede.id;
      }
      return null;
    } catch (error) {
      console.warn('Error getting active sede:', error);
      return null;
    }
  }

  // === CATEGORÍAS ===
  async getCategories(): Promise<InventoryCategory[]> {
    const { data, error } = await supabase
      .from('inventory_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error('Error fetching inventory categories:', error);
      throw error;
    }

    return data || [];
  }

  async createCategory(categoryData: CreateInventoryCategoryData): Promise<InventoryCategory> {
    const { data, error } = await supabase
      .from('inventory_categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      console.error('Error creating inventory category:', error);
      throw error;
    }

    return data;
  }

  async updateCategory(id: string, updates: Partial<InventoryCategory>): Promise<InventoryCategory> {
    const { data, error } = await supabase
      .from('inventory_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating inventory category:', error);
      throw error;
    }

    return data;
  }
  
  // === PRODUCTOS ===
  async getProducts(): Promise<InventoryProduct[]> {
    let query = supabase
      .from('inventory_products')
      .select(`
        *,
        category:inventory_categories(*)
      `)
      .eq('is_active', true);

    // Aplicar filtro por sede
    const activeSedeId = this.getActiveSedeId();
    if (activeSedeId) {
      query = query.eq('sede_id', activeSedeId);
    }

    const { data, error } = await query.order('sort_order');

    if (error) {
      console.error('Error fetching inventory products:', error);
      throw error;
    }

    return data || [];
  }

  async getProductsByCategory(categoryId: string): Promise<InventoryProduct[]> {
    let query = supabase
      .from('inventory_products')
      .select(`
        *,
        category:inventory_categories(*)
      `)
      .eq('category_id', categoryId)
      .eq('is_active', true);

    // Aplicar filtro por sede
    const activeSedeId = this.getActiveSedeId();
    if (activeSedeId) {
      query = query.eq('sede_id', activeSedeId);
    }

    const { data, error } = await query.order('sort_order');

    if (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }

    return data || [];
  }

  async createProduct(productData: CreateInventoryProductData): Promise<InventoryProduct> {
    // Agregar sede_id automáticamente
    const activeSedeId = this.getActiveSedeId();
    if (!activeSedeId) {
      throw new Error('No se puede crear el producto: no hay una sede activa seleccionada');
    }

    const dataToInsert = {
      ...productData,
      sede_id: activeSedeId
    };

    const { data, error } = await supabase
      .from('inventory_products')
      .insert(dataToInsert)
      .select(`
        *,
        category:inventory_categories(*)
      `)
      .single();

    if (error) {
      console.error('Error creating inventory product:', error);
      throw error;
    }

    return data;
  }

  async updateProduct(id: string, updates: Partial<InventoryProduct>): Promise<InventoryProduct> {
    const { data, error } = await supabase
      .from('inventory_products')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        category:inventory_categories(*)
      `)
      .single();

    if (error) {
      console.error('Error updating inventory product:', error);
      throw error;
    }

    return data;
  }

  // === STOCK ===
  async getStockWithProducts(): Promise<InventoryStockWithProduct[]> {
    let query = supabase
      .from('inventory_stock')
      .select(`
        *,
        product:inventory_products(
          *,
          category:inventory_categories(*)
        )
      `);

    // Aplicar filtro por sede
    const activeSedeId = this.getActiveSedeId();
    if (activeSedeId) {
      query = query.eq('sede_id', activeSedeId);
    }

    const { data, error } = await query.order('last_updated', { ascending: false });

    if (error) {
      console.error('Error fetching inventory stock:', error);
      throw error;
    }

    return data || [];
  }

  async getStockByProduct(productId: string): Promise<InventoryStock | null> {
    const { data, error } = await supabase
      .from('inventory_stock')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching stock by product:', error);
      throw error;
    }

    return data || null;
  }

  async createStock(stockData: CreateInventoryStockData & { updated_by: string }): Promise<InventoryStock> {
    // Agregar sede_id automáticamente
    const activeSedeId = this.getActiveSedeId();
    if (!activeSedeId) {
      throw new Error('No se puede crear el stock: no hay una sede activa seleccionada');
    }

    const dataToInsert = {
      ...stockData,
      sede_id: activeSedeId
    };

    const { data, error } = await supabase
      .from('inventory_stock')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating inventory stock:', error);
      throw error;
    }

    return data;
  }

  async updateStock(productId: string, updates: UpdateInventoryStockData & { updated_by: string }): Promise<InventoryStock> {
    const { data, error } = await supabase
      .from('inventory_stock')
      .update(updates)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      console.error('Error updating inventory stock:', error);
      throw error;
    }

    return data;
  }

  // === CONFIGURACIÓN DE CONSUMO ===
  async getConsumptionConfig(): Promise<PropertyConsumptionWithDetails[]> {
    const { data, error } = await supabase
      .from('property_consumption_config')
      .select(`
        *,
        product:inventory_products(
          *,
          category:inventory_categories(*)
        ),
        property:properties(*)
      `)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching consumption config:', error);
      throw error;
    }

    return data || [];
  }

  async getConsumptionByProperty(propertyId: string): Promise<PropertyConsumptionConfig[]> {
    const { data, error } = await supabase
      .from('property_consumption_config')
      .select(`
        *,
        product:inventory_products(
          *,
          category:inventory_categories(*)
        )
      `)
      .eq('property_id', propertyId)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching consumption by property:', error);
      throw error;
    }

    return data || [];
  }

  async createConsumptionConfig(configData: CreatePropertyConsumptionConfigData): Promise<PropertyConsumptionConfig> {
    const { data, error } = await supabase
      .from('property_consumption_config')
      .insert(configData)
      .select()
      .single();

    if (error) {
      console.error('Error creating consumption config:', error);
      throw error;
    }

    return data;
  }

  async updateConsumptionConfig(id: string, updates: Partial<PropertyConsumptionConfig>): Promise<PropertyConsumptionConfig> {
    const { data, error } = await supabase
      .from('property_consumption_config')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating consumption config:', error);
      throw error;
    }

    return data;
  }

  // === MOVIMIENTOS ===
  async getMovements(limit = 100): Promise<InventoryMovementWithDetails[]> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select(`
        *,
        product:inventory_products(
          *,
          category:inventory_categories(*)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching inventory movements:', error);
      throw error;
    }

    return data || [];
  }

  async getMovementsByProduct(productId: string, limit = 50): Promise<InventoryMovement[]> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching movements by product:', error);
      throw error;
    }

    return data || [];
  }

  async createMovement(movementData: CreateInventoryMovementData & { 
    previous_quantity: number; 
    new_quantity: number; 
    created_by: string; 
  }): Promise<InventoryMovement> {
    const { data, error } = await supabase
      .from('inventory_movements')
      .insert(movementData)
      .select()
      .single();

    if (error) {
      console.error('Error creating inventory movement:', error);
      throw error;
    }

    return data;
  }

  // === ALERTAS ===
  async getActiveAlerts(): Promise<InventoryAlert[]> {
    const { data, error } = await supabase
      .from('inventory_alerts')
      .select(`
        *,
        product:inventory_products(
          *,
          category:inventory_categories(*)
        )
      `)
      .eq('is_active', true)
      .order('triggered_at', { ascending: false });

    if (error) {
      console.error('Error fetching active alerts:', error);
      throw error;
    }

    return data || [];
  }

  async createAlert(alertData: CreateInventoryAlertData): Promise<InventoryAlert> {
    const { data, error } = await supabase
      .from('inventory_alerts')
      .insert(alertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating inventory alert:', error);
      throw error;
    }

    return data;
  }

  async resolveAlert(id: string): Promise<InventoryAlert> {
    const { data, error } = await supabase
      .from('inventory_alerts')
      .update({ 
        is_active: false,
        resolved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }

    return data;
  }

  // === DASHBOARD STATS ===
  async getDashboardStats(): Promise<InventoryDashboardStats> {
    // Obtener total de productos activos
    const { count: totalProducts } = await supabase
      .from('inventory_products')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    // Obtener alertas activas por tipo
    const { data: alerts } = await supabase
      .from('inventory_alerts')
      .select('alert_type')
      .eq('is_active', true);

    const lowStockAlerts = alerts?.filter(a => a.alert_type === 'stock_bajo').length || 0;
    const criticalAlerts = alerts?.filter(a => a.alert_type === 'stock_critico').length || 0;

    // Obtener movimientos de hoy
    const today = new Date().toISOString().split('T')[0];
    const { count: todayMovements } = await supabase
      .from('inventory_movements')
      .select('id', { count: 'exact' })
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);

    return {
      total_products: totalProducts || 0,
      low_stock_alerts: lowStockAlerts,
      critical_alerts: criticalAlerts,
      total_movements_today: todayMovements || 0
    };
  }
}

export const inventoryStorage = new InventoryStorageService();