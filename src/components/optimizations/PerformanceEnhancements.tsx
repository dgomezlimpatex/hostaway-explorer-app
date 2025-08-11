import React, { memo, useMemo, useCallback, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';

// Simple performance wrapper for calendar
export const withPerformanceOptimization = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return memo((props: P) => {
    return (
      <Suspense fallback={<LoadingSpinner size="sm" text="Cargando..." />}>
        <Component {...props} />
      </Suspense>
    );
  });
};

// Performance notice component
export const PerformanceNotice = memo<{ itemCount: number; type: string }>(
  ({ itemCount, type }) => {
    if (itemCount < 50) return null;

    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-100 text-blue-700">
            ⚡ Optimizado
          </Badge>
          <span className="text-sm text-blue-700">
            Renderizando {itemCount} {type} con optimizaciones de rendimiento
          </span>
        </div>
      </div>
    );
  }
);

PerformanceNotice.displayName = 'PerformanceNotice';

// Quick optimization tips component
export const OptimizationTips = memo(() => (
  <Card className="mt-6">
    <CardHeader>
      <CardTitle className="text-lg">🚀 Optimizaciones Aplicadas</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        <span className="text-sm">Memoización de componentes críticos</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        <span className="text-sm">Lazy loading de modales y widgets</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        <span className="text-sm">Callbacks optimizados para reducir re-renders</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        <span className="text-sm">Cálculos memoizados de métricas</span>
      </div>
      
      <div className="pt-3 border-t">
        <p className="text-xs text-muted-foreground">
          💡 Para listas muy grandes (&gt;50 elementos), se aplicarán optimizaciones adicionales automáticamente
        </p>
      </div>
    </CardContent>
  </Card>
));

OptimizationTips.displayName = 'OptimizationTips';