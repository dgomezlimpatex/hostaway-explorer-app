import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Package, AlertTriangle, Calendar } from "lucide-react";
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';
import { useInventoryStock } from '@/hooks/useInventory';
import { useMovements } from '@/hooks/useMovements';
import { useQuery } from '@tanstack/react-query';
import { inventoryStorage } from '@/services/storage/inventoryStorage';

export default function InventoryReports() {
  const { data: stockWithProducts } = useInventoryStock();
  const { movements } = useMovements();
  const inventoryService = inventoryStorage;

  const { data: dashboardStats } = useQuery({
    queryKey: ['inventory-dashboard-stats'],
    queryFn: () => inventoryService.getDashboardStats(),
  });

  const lowStockProducts = stockWithProducts?.filter(
    stock => stock.current_quantity <= stock.minimum_stock
  ) || [];

  const criticalStockProducts = stockWithProducts?.filter(
    stock => stock.current_quantity <= (stock.minimum_stock * 0.5)
  ) || [];

  const todayMovements = movements?.filter(
    movement => new Date(movement.created_at).toDateString() === new Date().toDateString()
  ) || [];

  return (
    <div>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reportes de Inventario</h1>
          <p className="text-muted-foreground">
            Análisis y métricas clave del inventario
          </p>
        </div>

        {/* Métricas principales */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockWithProducts?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Productos en inventario
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{lowStockProducts.length}</div>
              <p className="text-xs text-muted-foreground">
                Productos con stock bajo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Crítico</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{criticalStockProducts.length}</div>
              <p className="text-xs text-muted-foreground">
                Productos en nivel crítico
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Movimientos Hoy</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayMovements.length}</div>
              <p className="text-xs text-muted-foreground">
                Movimientos registrados hoy
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Productos con stock bajo */}
        {lowStockProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Productos con Stock Bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockProducts.map((stock) => (
                  <div key={stock.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div>
                      <p className="font-medium">{stock.product.name}</p>
                      <p className="text-sm text-muted-foreground">{stock.product.category.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        <span className="font-medium text-yellow-700">{stock.current_quantity}</span>
                        <span className="text-muted-foreground"> / {stock.minimum_stock} {stock.product.unit_of_measure}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Productos con stock crítico */}
        {criticalStockProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Productos con Stock Crítico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {criticalStockProducts.map((stock) => (
                  <div key={stock.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div>
                      <p className="font-medium">{stock.product.name}</p>
                      <p className="text-sm text-muted-foreground">{stock.product.category.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        <span className="font-medium text-red-700">{stock.current_quantity}</span>
                        <span className="text-muted-foreground"> / {stock.minimum_stock} {stock.product.unit_of_measure}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensaje cuando todo está bien */}
        {lowStockProducts.length === 0 && criticalStockProducts.length === 0 && stockWithProducts && stockWithProducts.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-green-600 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-green-700">Inventario en Buen Estado</h3>
                <p className="text-muted-foreground">
                  Todos los productos mantienen niveles de stock adecuados.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      <RoleBasedNavigation />
    </div>
  );
}