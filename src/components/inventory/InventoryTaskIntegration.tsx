import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Package, Clock } from "lucide-react";
import { useConsumptionConfig } from '@/hooks/useConsumptionConfig';
import { useInventoryStock } from '@/hooks/useInventory';
import { useToast } from '@/hooks/use-toast';

interface TaskIntegrationProps {
  taskId: string;
  propertyId: string;
  onTaskComplete?: () => void;
}

export function InventoryTaskIntegration({ taskId, propertyId, onTaskComplete }: TaskIntegrationProps) {
  const { consumptionConfigs: consumptionConfig = [] } = useConsumptionConfig();
  const { data: stock = [] } = useInventoryStock();
  const { toast } = useToast();

  // Configuraciones para esta propiedad
  const propertyConfig = consumptionConfig.filter(config => 
    config.property_id === propertyId && config.is_active
  );

  // Verificar stock disponible para cada producto configurado
  const stockVerification = propertyConfig.map(config => {
    const stockItem = stock.find(s => s.product_id === config.product_id);
    const requiredQuantity = config.quantity_per_cleaning;
    const currentStock = stockItem?.current_quantity || 0;
    const isAvailable = currentStock >= requiredQuantity;
    
    return {
      ...config,
      currentStock,
      requiredQuantity,
      isAvailable,
      stockItem
    };
  });

  const totalProducts = stockVerification.length;
  const availableProducts = stockVerification.filter(v => v.isAvailable).length;
  const stockCoverage = totalProducts > 0 ? (availableProducts / totalProducts) * 100 : 100;

  // Alertar sobre productos sin stock suficiente
  useEffect(() => {
    const insufficientStock = stockVerification.filter(v => !v.isAvailable);
    
    if (insufficientStock.length > 0) {
      toast({
        title: "⚠️ Stock Insuficiente",
        description: `${insufficientStock.length} productos sin stock suficiente para esta tarea`,
        variant: "destructive",
      });
    }
  }, [stockVerification, toast]);

  const getStockStatus = (verification: typeof stockVerification[0]) => {
    if (verification.currentStock === 0) {
      return { label: "Sin stock", variant: "destructive" as const, icon: AlertCircle };
    }
    if (!verification.isAvailable) {
      return { label: "Stock bajo", variant: "secondary" as const, icon: AlertCircle };
    }
    return { label: "Disponible", variant: "default" as const, icon: CheckCircle };
  };

  if (propertyConfig.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4" />
            Inventario para esta tarea
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay configuración de consumo para esta propiedad
            </p>
            <Badge variant="outline" className="mt-2">
              Sin productos configurados
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4" />
            Stock Requerido para esta Tarea
          </CardTitle>
          <Badge variant={stockCoverage === 100 ? "default" : "destructive"}>
            {Math.round(stockCoverage)}% disponible
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barra de progreso general */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Cobertura de stock</span>
            <span>{availableProducts}/{totalProducts} productos</span>
          </div>
          <Progress value={stockCoverage} className="h-2" />
        </div>

        {/* Lista de productos requeridos */}
        <div className="space-y-3">
          {stockVerification.map((verification) => {
            const status = getStockStatus(verification);
            const StatusIcon = status.icon;
            
            return (
              <div key={verification.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <StatusIcon className="h-4 w-4" />
                  <div>
                    <p className="font-medium text-sm">
                      {verification.product?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Requiere {verification.requiredQuantity} {verification.product?.unit_of_measure}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={status.variant} className="mb-1">
                    {status.label}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Stock: {verification.currentStock}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen de estado */}
        <div className="pt-2 border-t">
          {stockCoverage === 100 ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Todos los productos están disponibles</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {totalProducts - availableProducts} productos sin stock suficiente
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}