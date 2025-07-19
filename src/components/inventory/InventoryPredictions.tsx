import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingDown, 
  Calendar, 
  AlertTriangle, 
  Package, 
  Clock,
  ShoppingCart
} from "lucide-react";
import { useInventoryPredictions } from '@/hooks/useInventoryPredictions';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export function InventoryPredictions() {
  const { predictions, stats, isLoading } = useInventoryPredictions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Predicciones de Inventario
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

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Clock className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const urgentPredictions = predictions.filter(p => 
    p.risk_level === 'critical' || p.risk_level === 'high' || p.days_until_minimum <= 7
  );

  return (
    <div className="space-y-6">
      {/* Estadísticas generales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm font-medium">Productos Críticos</p>
                <p className="text-2xl font-bold text-destructive">{stats.criticalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Alto Riesgo</p>
                <p className="text-2xl font-bold text-orange-500">{stats.highRiskProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Promedio Días</p>
                <p className="text-2xl font-bold">{stats.avgDaysUntilDepletion}</p>
                <p className="text-xs text-muted-foreground">hasta agotamiento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Productos</p>
                <p className="text-2xl font-bold">{stats.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas urgentes */}
      {urgentPredictions.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atención requerida:</strong> {urgentPredictions.length} productos necesitan reposición urgente.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de predicciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Predicciones Detalladas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {predictions.slice(0, 20).map((prediction) => (
              <div key={prediction.product_id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{prediction.product_name}</h3>
                    <p className="text-sm text-muted-foreground">{prediction.category_name}</p>
                  </div>
                  <Badge variant={getRiskBadgeVariant(prediction.risk_level)} className="flex items-center gap-1">
                    {getRiskIcon(prediction.risk_level)}
                    {prediction.risk_level === 'critical' ? 'Crítico' :
                     prediction.risk_level === 'high' ? 'Alto Riesgo' :
                     prediction.risk_level === 'medium' ? 'Medio Riesgo' : 'Bajo Riesgo'}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Stock Actual</p>
                    <p className="text-sm font-medium">
                      {prediction.current_stock} {prediction.unit_of_measure}
                    </p>
                    <Progress 
                      value={Math.min(100, (prediction.current_stock / (prediction.minimum_stock * 2)) * 100)} 
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Consumo Diario</p>
                    <p className="text-sm font-medium">
                      {prediction.daily_consumption_avg} {prediction.unit_of_measure}/día
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Días hasta Mínimo</p>
                    <p className="text-sm font-medium">
                      {prediction.days_until_minimum === Infinity 
                        ? 'N/A' 
                        : `${prediction.days_until_minimum} días`
                      }
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Agotamiento Estimado</p>
                    <p className="text-sm font-medium">
                      {prediction.predicted_depletion_date 
                        ? format(prediction.predicted_depletion_date, 'dd/MM/yyyy', { locale: es })
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>

                {prediction.next_tasks_consumption > 0 && (
                  <div className="bg-muted p-2 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Próximas tareas consumirán: {prediction.next_tasks_consumption} {prediction.unit_of_measure}</span>
                    </div>
                  </div>
                )}

                {(prediction.risk_level === 'high' || prediction.risk_level === 'critical') && (
                  <div className="bg-destructive/10 p-2 rounded text-sm border border-destructive/20">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-destructive" />
                      <span className="text-destructive font-medium">
                        Cantidad sugerida para pedido: {prediction.suggested_order_quantity} {prediction.unit_of_measure}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {predictions.length > 20 && (
            <div className="text-center mt-4 p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando 20 de {predictions.length} productos. Los más urgentes se muestran primero.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}