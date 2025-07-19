import { useMemo } from 'react';
import { useInventoryStock, useInventoryMovements } from '@/hooks/useInventory';
import { useConsumptionConfig } from '@/hooks/useConsumptionConfig';
import { subDays, addDays, startOfDay } from 'date-fns';

interface PredictionData {
  product_id: string;
  product_name: string;
  category_name: string;
  current_stock: number;
  minimum_stock: number;
  daily_consumption_avg: number;
  days_until_minimum: number;
  days_until_depletion: number;
  suggested_order_quantity: number;
  next_tasks_consumption: number;
  predicted_depletion_date: Date | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  unit_of_measure: string;
}

export function useInventoryPredictions() {
  const { data: stock = [] } = useInventoryStock();
  const { data: movements = [] } = useInventoryMovements(100);
  const { consumptionConfigs } = useConsumptionConfig();

  const predictions = useMemo((): PredictionData[] => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    
    return stock.map(stockItem => {
      const productId = stockItem.product_id;
      const productName = stockItem.product?.name || 'Producto desconocido';
      const categoryName = stockItem.product?.category?.name || 'Sin categoría';
      const currentStock = stockItem.current_quantity;
      const minimumStock = stockItem.minimum_stock;
      const unitOfMeasure = stockItem.product?.unit_of_measure || 'unidades';

      // Calcular consumo promedio diario basado en movimientos históricos
      const productMovements = movements.filter(m => 
        m.product_id === productId && 
        new Date(m.created_at) >= thirtyDaysAgo &&
        (m.movement_type === 'salida' || m.movement_type === 'consumo_automatico')
      );

      const totalConsumed = productMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
      const dailyConsumptionAvg = totalConsumed / 30; // Promedio de 30 días

      // Calcular consumo estimado de próximas tareas (simplificado para evitar errores)
      const futureTasksConsumption = consumptionConfigs
        .filter(config => config.product_id === productId && config.is_active)
        .reduce((total, config) => {
          // Estimación simplificada: 5 tareas futuras promedio por propiedad
          return total + (5 * config.quantity_per_cleaning);
        }, 0);

      // Calcular días hasta stock mínimo y agotamiento
      const daysUntilMinimum = dailyConsumptionAvg > 0 
        ? Math.max(0, (currentStock - minimumStock) / dailyConsumptionAvg)
        : Infinity;

      const daysUntilDepletion = dailyConsumptionAvg > 0 
        ? Math.max(0, currentStock / dailyConsumptionAvg)
        : Infinity;

      // Fecha estimada de agotamiento
      const predictedDepletionDate = daysUntilDepletion !== Infinity 
        ? addDays(new Date(), Math.floor(daysUntilDepletion))
        : null;

      // Cantidad sugerida de pedido (para 30 días + buffer del 20%)
      const suggestedOrderQuantity = Math.max(
        minimumStock * 2, // Mínimo el doble del stock mínimo
        Math.ceil((dailyConsumptionAvg * 30) * 1.2) // 30 días + 20% buffer
      );

      // Determinar nivel de riesgo
      let riskLevel: PredictionData['risk_level'] = 'low';
      if (currentStock === 0) {
        riskLevel = 'critical';
      } else if (currentStock <= minimumStock) {
        riskLevel = 'high';
      } else if (daysUntilMinimum <= 7) {
        riskLevel = 'medium';
      }

      return {
        product_id: productId,
        product_name: productName,
        category_name: categoryName,
        current_stock: currentStock,
        minimum_stock: minimumStock,
        daily_consumption_avg: Number(dailyConsumptionAvg.toFixed(2)),
        days_until_minimum: Number(daysUntilMinimum.toFixed(1)),
        days_until_depletion: Number(daysUntilDepletion.toFixed(1)),
        suggested_order_quantity: suggestedOrderQuantity,
        next_tasks_consumption: futureTasksConsumption,
        predicted_depletion_date: predictedDepletionDate,
        risk_level: riskLevel,
        unit_of_measure: unitOfMeasure
      };
    });
  }, [stock, movements, consumptionConfigs]);

  // Estadísticas generales
  const stats = useMemo(() => {
    const totalProducts = predictions.length;
    const criticalProducts = predictions.filter(p => p.risk_level === 'critical').length;
    const highRiskProducts = predictions.filter(p => p.risk_level === 'high').length;
    const mediumRiskProducts = predictions.filter(p => p.risk_level === 'medium').length;
    
    const avgDaysUntilDepletion = predictions
      .filter(p => p.days_until_depletion !== Infinity)
      .reduce((sum, p) => sum + p.days_until_depletion, 0) / 
      predictions.filter(p => p.days_until_depletion !== Infinity).length || 0;

    return {
      totalProducts,
      criticalProducts,
      highRiskProducts,
      mediumRiskProducts,
      avgDaysUntilDepletion: Number(avgDaysUntilDepletion.toFixed(1))
    };
  }, [predictions]);

  return {
    predictions: predictions.sort((a, b) => {
      // Ordenar por nivel de riesgo primero, luego por días hasta agotamiento
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (riskOrder[a.risk_level] !== riskOrder[b.risk_level]) {
        return riskOrder[a.risk_level] - riskOrder[b.risk_level];
      }
      return a.days_until_depletion - b.days_until_depletion;
    }),
    stats,
    isLoading: false
  };
}