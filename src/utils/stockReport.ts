import type { StockLevel, StockMovement } from '@/types/stock';

export interface ReorderItem {
  level: StockLevel;
  needed: number;
  estimatedCost: number;
}

export interface ConsumptionItem {
  product: string;
  quantity: number;
  value: number;
}

export interface StockReport {
  automaticConsumption: StockMovement[];
  exits: StockMovement[];
  entries: StockMovement[];
  lowStock: StockLevel[];
  reorder: ReorderItem[];
  consumptionByProduct: ConsumptionItem[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Valor de un movimiento: el coste guardado en el propio movimiento si existe; si no,
 * el coste actual del producto en el almacén del movimiento y, en último caso, el de otro
 * almacén de la misma sede. Sin ningún coste, no valora.
 */
export const movementUnitCost = (
  movement: StockMovement,
  costByProductWarehouse: Map<string, number>,
  costByProduct: Map<string, number>
): number =>
  movement.unit_cost_at_movement
  ?? costByProductWarehouse.get(`${movement.product_id}|${movement.warehouse_id}`)
  ?? costByProduct.get(movement.product_id)
  ?? 0;

export const buildStockReport = (movements: StockMovement[], levels: StockLevel[]): StockReport => {
  const costByProductWarehouse = new Map<string, number>();
  const costByProduct = new Map<string, number>();
  for (const level of levels) {
    if (level.cost_per_unit == null) continue;
    costByProductWarehouse.set(`${level.product_id}|${level.warehouse_id}`, level.cost_per_unit);
    if (!costByProduct.has(level.product_id)) costByProduct.set(level.product_id, level.cost_per_unit);
  }

  const automaticConsumption = movements.filter((movement) => movement.movement_type === 'consumo_automatico');
  const exits = movements.filter((movement) => movement.movement_type === 'salida' || movement.movement_type === 'consumo_automatico');
  const entries = movements.filter((movement) => movement.movement_type === 'entrada');
  const lowStock = levels.filter((level) => level.quantity_basis !== 'partial' && level.minimum_quantity > 0 && level.current_quantity <= level.minimum_quantity);

  const reorder = levels.filter(level => level.quantity_basis !== 'partial')
    .map((level) => {
      const needed = Math.max(0, level.target_quantity - level.current_quantity);
      return { level, needed, estimatedCost: round2(needed * (level.cost_per_unit || 0)) };
    })
    .filter((item) => item.needed > 0)
    .sort((a, b) => b.needed - a.needed);

  const byProduct = new Map<string, ConsumptionItem>();
  for (const movement of exits) {
    const current = byProduct.get(movement.product_id) || { product: movement.product?.name || 'Producto', quantity: 0, value: 0 };
    current.quantity = round2(current.quantity + movement.quantity);
    current.value = round2(current.value + movement.quantity * movementUnitCost(movement, costByProductWarehouse, costByProduct));
    byProduct.set(movement.product_id, current);
  }

  return {
    automaticConsumption,
    exits,
    entries,
    lowStock,
    reorder,
    consumptionByProduct: [...byProduct.values()].sort((a, b) => b.quantity - a.quantity),
  };
};

const csvCell = (value: string | number) => {
  const text = String(value);
  // Evita que una hoja de cálculo interprete el texto como fórmula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const REORDER_CSV_HEADERS = ['tipo', 'producto', 'almacen', 'unidad', 'actual', 'minimo', 'objetivo', 'reponer', 'coste_unidad', 'coste_estimado'];

export const reorderToCsv = (items: ReorderItem[]): string => {
  const rows = [...items]
    .sort((a, b) =>
      `${a.level.product?.category?.name || ''}|${a.level.product?.name || ''}|${a.level.warehouse?.name || ''}`
        .localeCompare(`${b.level.product?.category?.name || ''}|${b.level.product?.name || ''}|${b.level.warehouse?.name || ''}`, 'es')
    )
    .map(({ level, needed, estimatedCost }) => [
      level.product?.category?.name || 'Sin tipo',
      level.product?.name || 'Producto',
      level.warehouse?.name || 'Almacén',
      level.product?.unit_of_measure || 'unidades',
      level.current_quantity,
      level.minimum_quantity,
      level.target_quantity,
      needed,
      level.cost_per_unit ?? '',
      estimatedCost,
    ]);
  return [REORDER_CSV_HEADERS.join(';'), ...rows.map((row) => row.map(csvCell).join(';'))].join('\n');
};
