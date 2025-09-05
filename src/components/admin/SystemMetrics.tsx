import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Database, Users, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface SystemMetrics {
  queryCache: {
    size: number;
    invalidQueries: number;
    stalequeries: number;
  };
  performance: {
    loadTime: number;
    memoryUsage?: number;
  };
  errors: string[];
  warnings: string[];
}

export const SystemMetrics = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    queryCache: { size: 0, invalidQueries: 0, stalequeries: 0 },
    performance: { loadTime: 0 },
    errors: [],
    warnings: []
  });

  const queryClient = useQueryClient();

  const collectMetrics = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Analyze query cache
    const invalidQueries = queries.filter(q => q.state.status === 'error').length;
    const staleQueries = queries.filter(q => q.isStale()).length;
    
    // Performance metrics
    const loadTime = performance.now();
    const memoryUsage = (performance as any).memory?.usedJSHeapSize || undefined;

    // Check for potential issues
    if (queries.length > 50) {
      warnings.push(`Cache grande: ${queries.length} queries activas`);
    }
    
    if (invalidQueries > 0) {
      errors.push(`${invalidQueries} queries con errores`);
    }
    
    if (staleQueries > queries.length * 0.3) {
      warnings.push(`Muchas queries obsoletas: ${staleQueries}`);
    }

    setMetrics({
      queryCache: {
        size: queries.length,
        invalidQueries,
        stalequeries: staleQueries
      },
      performance: {
        loadTime,
        memoryUsage
      },
      errors,
      warnings
    });
  };

  useEffect(() => {
    collectMetrics();
    const interval = setInterval(collectMetrics, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [queryClient]);

  const clearCache = () => {
    queryClient.clear();
    setTimeout(collectMetrics, 100);
  };

  const getHealthStatus = () => {
    if (metrics.errors.length > 0) return 'error';
    if (metrics.warnings.length > 0) return 'warning';
    return 'healthy';
  };

  const healthColors = {
    healthy: 'text-green-600 bg-green-100',
    warning: 'text-yellow-600 bg-yellow-100',
    error: 'text-red-600 bg-red-100'
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estado del Sistema</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Badge className={healthColors[getHealthStatus()]}>
            {getHealthStatus() === 'healthy' && <CheckCircle className="h-3 w-3 mr-1" />}
            {getHealthStatus() === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
            {getHealthStatus() === 'error' && <AlertTriangle className="h-3 w-3 mr-1" />}
            {getHealthStatus() === 'healthy' ? 'Saludable' : 
             getHealthStatus() === 'warning' ? 'Advertencias' : 'Errores'}
          </Badge>
          <div className="text-xs text-muted-foreground mt-2">
            {metrics.errors.length + metrics.warnings.length} problemas detectados
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cache de Queries</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.queryCache.size}</div>
          <div className="text-xs text-muted-foreground">
            {metrics.queryCache.invalidQueries} errores, {metrics.queryCache.stalequeries} obsoletas
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rendimiento</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round(metrics.performance.loadTime)}ms
          </div>
          <div className="text-xs text-muted-foreground">
            {metrics.performance.memoryUsage 
              ? `${Math.round(metrics.performance.memoryUsage / 1024 / 1024)}MB memoria`
              : 'Tiempo de carga'
            }
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Acciones</CardTitle>
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={collectMetrics}
              className="w-full"
            >
              Actualizar Métricas
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearCache}
              className="w-full"
            >
              Limpiar Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {(metrics.errors.length > 0 || metrics.warnings.length > 0) && (
        <Card className="md:col-span-2 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Problemas Detectados</CardTitle>
            <CardDescription>
              Errores y advertencias del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.errors.map((error, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              ))}
              {metrics.warnings.map((warning, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  {warning}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};