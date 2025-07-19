import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryStorage } from '@/services/storage/inventoryStorage';
import { useToast } from '@/hooks/use-toast';
import { InventoryMovementType, InventoryAlertType } from '@/types/inventory';

export function useAutomaticConsumption() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const processConsumptionMutation = useMutation({
    mutationFn: async ({ taskId, propertyId, userId }: { 
      taskId: string; 
      propertyId: string; 
      userId: string;
    }) => {
      // Obtener configuraciones de consumo para la propiedad
      const configs = await inventoryStorage.getConsumptionByProperty(propertyId);
      
      if (!configs || configs.length === 0) {
        return { processed: 0, message: 'No hay configuraciones de consumo para esta propiedad' };
      }

      const results = [];
      
      for (const config of configs) {
        if (!config.is_active) continue;

        try {
          // Obtener stock actual del producto
          const stock = await inventoryStorage.getStockByProduct(config.product_id);
          
          if (!stock || stock.current_quantity < config.quantity_per_cleaning) {
            // Si no hay stock suficiente, crear alerta
            await inventoryStorage.createAlert({
              product_id: config.product_id,
              alert_type: 'stock_bajo' as InventoryAlertType
            });
            
            results.push({
              productName: config.product?.name || 'Producto desconocido',
              success: false,
              reason: 'Stock insuficiente'
            });
            continue;
          }

          // Calcular nueva cantidad
          const newQuantity = stock.current_quantity - config.quantity_per_cleaning;

          // Actualizar stock
          await inventoryStorage.updateStock(config.product_id, {
            current_quantity: newQuantity,
            updated_by: userId
          });

          // Crear movimiento de inventario
          await inventoryStorage.createMovement({
            product_id: config.product_id,
            movement_type: 'consumo_automatico' as InventoryMovementType,
            quantity: config.quantity_per_cleaning,
            previous_quantity: stock.current_quantity,
            new_quantity: newQuantity,
            reason: `Consumo automático - Tarea completada`,
            created_by: userId,
            property_id: propertyId,
            task_id: taskId
          });

          // Verificar si el nuevo stock está por debajo del mínimo
          if (newQuantity <= stock.minimum_stock) {
            await inventoryStorage.createAlert({
              product_id: config.product_id,
              alert_type: newQuantity === 0 ? 'stock_critico' : 'stock_bajo' as InventoryAlertType
            });
          }

          results.push({
            productName: config.product?.name || 'Producto desconocido',
            quantity: config.quantity_per_cleaning,
            success: true
          });

        } catch (error) {
          console.error('Error procesando consumo automático:', error);
          results.push({
            productName: config.product?.name || 'Producto desconocido',
            success: false,
            reason: 'Error en el procesamiento'
          });
        }
      }

      return { processed: results.length, results };
    },
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });

      const successCount = data.results?.filter(r => r.success).length || 0;
      const failCount = (data.results?.length || 0) - successCount;

      if (successCount > 0) {
        toast({
          title: "Consumo automático procesado",
          description: `${successCount} productos consumidos correctamente${failCount > 0 ? `, ${failCount} con errores` : ''}`,
        });
      }

      if (failCount > 0 && successCount === 0) {
        toast({
          title: "Error en consumo automático",
          description: "No se pudieron procesar los consumos automáticos",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error('Error en consumo automático:', error);
      toast({
        title: "Error",
        description: "Error al procesar el consumo automático de inventario",
        variant: "destructive"
      });
    }
  });

  return {
    processConsumption: processConsumptionMutation.mutate,
    isProcessing: processConsumptionMutation.isPending,
    error: processConsumptionMutation.error
  };
}