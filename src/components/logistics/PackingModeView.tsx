import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Package,
  CheckCircle,
  Clock,
  Building2,
  Box,
  Users,
  Scan,
  AlertCircle,
  Check,
  X
} from "lucide-react";

interface PackingItem {
  id: string;
  product_id: string;
  quantity: number;
  property_id: string | null;
  is_property_package: boolean;
  packed_quantity?: number;
  is_packed?: boolean;
  products_summary?: Array<{
    quantity: number;
    product_id: string;
    product_name: string;
  }> | null;
  inventory_products: {
    name: string;
  };
  properties: {
    nombre: string;
    codigo: string;
  } | null;
}

interface PackingModeProps {
  items: PackingItem[];
  picklistCode: string;
  onItemPacked: (itemId: string, packed: boolean) => void;
  onComplete: () => void;
  workerId?: string;
  workerName?: string;
}

export const PackingModeView: React.FC<PackingModeProps> = ({
  items,
  picklistCode,
  onItemPacked,
  onComplete,
  workerId,
  workerName
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isQuickMode, setIsQuickMode] = useState(isMobile);

  // Group items by property for better organization
  const groupedItems = useMemo(() => {
    const groups = items.reduce((acc, item) => {
      if (item.is_property_package && item.properties) {
        const key = item.properties.codigo;
        if (!acc[key]) {
          acc[key] = {
            property: item.properties,
            packages: [],
            individual: []
          };
        }
        acc[key].packages.push(item);
        
        // Add individual products from package
        if (item.products_summary) {
          item.products_summary.forEach(product => {
            acc[key].individual.push({
              ...item,
              id: `${item.id}_${product.product_id}`,
              inventory_products: { name: product.product_name },
              quantity: product.quantity,
              is_property_package: false
            });
          });
        }
      } else {
        if (!acc['individual']) {
          acc['individual'] = {
            property: null,
            packages: [],
            individual: []
          };
        }
        acc['individual'].individual.push(item);
      }
      return acc;
    }, {} as Record<string, any>);

    return Object.entries(groups).map(([key, group]) => ({
      key,
      ...group
    }));
  }, [items]);

  // Calculate packing progress
  const packingProgress = useMemo(() => {
    const totalItems = items.length;
    const packedItems = items.filter(item => item.is_packed).length;
    const percentage = totalItems > 0 ? (packedItems / totalItems) * 100 : 0;
    
    return {
      total: totalItems,
      packed: packedItems,
      remaining: totalItems - packedItems,
      percentage: Math.round(percentage)
    };
  }, [items]);

  const handleItemToggle = useCallback((itemId: string, packed: boolean) => {
    onItemPacked(itemId, packed);
    
    if (packed) {
      // Haptic feedback on mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      toast({
        title: "Item empacado",
        description: "Item marcado como empacado",
        duration: 1500
      });
    }
  }, [onItemPacked, toast]);

  const handleCompleteAll = useCallback(() => {
    const unpackedItems = items.filter(item => !item.is_packed);
    unpackedItems.forEach(item => {
      onItemPacked(item.id, true);
    });
    
    toast({
      title: "Todos los items empacados",
      description: "Se han marcado todos los items como empacados"
    });
  }, [items, onItemPacked, toast]);

  if (isQuickMode) {
    return (
      <div className="space-y-4">
        {/* Quick Mode Header */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scan className="h-5 w-5" />
                Modo Empaque Rápido
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsQuickMode(false)}
              >
                Vista Detallada
              </Button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{picklistCode}</span>
              {workerName && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {workerName}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{packingProgress.packed} / {packingProgress.total} empacados</span>
                <span className="text-primary font-medium">{packingProgress.percentage}%</span>
              </div>
              <Progress value={packingProgress.percentage} className="h-2" />
              <div className="flex gap-2">
                <Button 
                  onClick={handleCompleteAll} 
                  size="sm" 
                  variant="outline"
                  disabled={packingProgress.remaining === 0}
                  className="flex-1"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Empacar Todo
                </Button>
                <Button 
                  onClick={onComplete}
                  disabled={packingProgress.remaining > 0}
                  size="sm"
                  className="flex-1"
                >
                  <Package className="mr-2 h-4 w-4" />
                  Finalizar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Packing List */}
        <div className="space-y-2">
          {items.map((item) => (
            <Card 
              key={item.id} 
              className={`transition-all duration-200 ${
                item.is_packed 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-background hover:shadow-md'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={item.is_packed || false}
                    onCheckedChange={(checked) => handleItemToggle(item.id, checked as boolean)}
                    className="h-5 w-5"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.is_property_package ? (
                        <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      ) : (
                        <Box className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">
                        {item.inventory_products.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span>Cant: {item.quantity}</span>
                      {item.properties && (
                        <span className="truncate">📍 {item.properties.codigo}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {item.is_packed ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <Clock className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Detailed Mode
  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="shadow-lg border-0 bg-gradient-to-r from-card to-card/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Empaque Detallado - {picklistCode}
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsQuickMode(true)}
            >
              Modo Rápido
            </Button>
          </div>
          {workerName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Trabajador: {workerName}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{packingProgress.total}</p>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{packingProgress.packed}</p>
                <p className="text-sm text-muted-foreground">Empacados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{packingProgress.remaining}</p>
                <p className="text-sm text-muted-foreground">Pendientes</p>
              </div>
            </div>
            
            <Progress value={packingProgress.percentage} className="h-3" />
            
            <div className="flex gap-2">
              <Button 
                onClick={handleCompleteAll}
                variant="outline" 
                size="sm"
                disabled={packingProgress.remaining === 0}
                className="flex-1"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Empacar Todo
              </Button>
              <Button 
                onClick={onComplete}
                disabled={packingProgress.remaining > 0}
                size="sm"
                className="flex-1"
              >
                Finalizar Empaque
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Items */}
      <div className="space-y-4">
        {groupedItems.map((group) => (
          <Card key={group.key} className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {group.property ? (
                  <>
                    <Building2 className="h-5 w-5 text-blue-500" />
                    {group.property.nombre} ({group.property.codigo})
                  </>
                ) : (
                  <>
                    <Box className="h-5 w-5 text-gray-500" />
                    Items Individuales
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Property Packages */}
                {group.packages.map((item) => (
                  <div 
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      item.is_packed ? 'bg-green-50 border-green-200' : 'bg-background'
                    }`}
                  >
                    <Checkbox
                      checked={item.is_packed || false}
                      onCheckedChange={(checked) => handleItemToggle(item.id, checked as boolean)}
                    />
                    
                    <div className="flex-1">
                      <div className="font-medium">{item.inventory_products.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Paquete completo - Cantidad: {item.quantity}
                      </div>
                    </div>

                    {item.is_packed ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                ))}

                {/* Individual Items */}
                {group.individual.map((item) => (
                  <div 
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      item.is_packed ? 'bg-green-50 border-green-200' : 'bg-background'
                    }`}
                  >
                    <Checkbox
                      checked={item.is_packed || false}
                      onCheckedChange={(checked) => handleItemToggle(item.id, checked as boolean)}
                    />
                    
                    <div className="flex-1">
                      <div className="font-medium">{item.inventory_products.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Cantidad: {item.quantity}
                      </div>
                    </div>

                    {item.is_packed ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};