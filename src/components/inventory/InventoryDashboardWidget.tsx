import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  Activity,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { useInventoryDashboardStats } from '@/hooks/useInventory';
import { Link } from 'react-router-dom';

export function InventoryDashboardWidget() {
  const { data: dashboardStats, isLoading } = useInventoryDashboardStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = dashboardStats || {
    total_products: 0,
    low_stock_alerts: 0,
    critical_alerts: 0,
    total_movements_today: 0
  };

  const hasAlerts = stats.low_stock_alerts > 0 || stats.critical_alerts > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-5 w-5" />
            Inventario
          </CardTitle>
          <Link to="/inventory">
            <Button variant="ghost" size="sm">
              Ver todo <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alertas críticas */}
        {hasAlerts && (
          <Alert variant={stats.critical_alerts > 0 ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {stats.critical_alerts > 0 && (
                <span className="font-medium text-destructive">
                  {stats.critical_alerts} productos sin stock
                </span>
              )}
              {stats.critical_alerts > 0 && stats.low_stock_alerts > 0 && ', '}
              {stats.low_stock_alerts > 0 && (
                <span className="font-medium">
                  {stats.low_stock_alerts} con stock bajo
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Estadísticas principales */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Productos</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_products}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Movimientos hoy</span>
            </div>
            <p className="text-2xl font-bold">{stats.total_movements_today}</p>
          </div>
        </div>

        {/* Estado general */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estado general</span>
            <Badge variant={hasAlerts ? "destructive" : "default"}>
              {hasAlerts ? "Requiere atención" : "Óptimo"}
            </Badge>
          </div>
        </div>

        {/* Enlaces rápidos */}
        <div className="flex gap-2 pt-2">
          <Link to="/inventory/stock" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              Stock
            </Button>
          </Link>
          <Link to="/inventory/movements" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              Movimientos
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}