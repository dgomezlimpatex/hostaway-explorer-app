import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  Upload,
  WifiOff
} from 'lucide-react';
import { offlineStorage } from '@/utils/offlineStorage';

export const OfflineSyncIndicator: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    pendingOperations: 0,
    offlineReports: 0,
    totalOperations: 0,
    failedOperations: 0
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Actualizar estadísticas periódicamente
  useEffect(() => {
    const updateStats = () => {
      setStats(offlineStorage.getStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Cada 5 segundos

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      const result = await offlineStorage.syncOperationsBatch(
        async (operation) => {
          // Aquí se implementaría la lógica específica de sincronización
          // Por ahora simularemos la sincronización
          console.log('Syncing operation:', operation);
          await new Promise(resolve => setTimeout(resolve, 500));
        },
        (current, total) => {
          setSyncProgress((current / total) * 100);
        }
      );

      toast({
        title: "Sincronización completada",
        description: `${result.success} elementos sincronizados correctamente.${result.failed > 0 ? ` ${result.failed} fallaron.` : ''}`,
        variant: result.failed > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Error de sincronización",
        description: "No se pudieron sincronizar algunos elementos offline.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const hasPendingData = stats.pendingOperations > 0 || stats.offlineReports > 0;

  if (!hasPendingData && isOnline) {
    return null; // No mostrar si no hay datos pendientes y estamos online
  }

  return (
    <div className={`bg-card border rounded-lg p-3 space-y-3 ${className}`}>
      {/* Estado de conexión */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <Cloud className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-medium">
            {isOnline ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>

        {hasPendingData && (
          <Badge variant={isOnline ? 'default' : 'secondary'}>
            {stats.pendingOperations + stats.offlineReports} pendientes
          </Badge>
        )}
      </div>

      {/* Detalles de datos offline */}
      {hasPendingData && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {stats.pendingOperations > 0 && (
              <div className="flex items-center space-x-1">
                <Upload className="h-3 w-3 text-blue-500" />
                <span>{stats.pendingOperations} operaciones</span>
              </div>
            )}
            
            {stats.offlineReports > 0 && (
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3 text-orange-500" />
                <span>{stats.offlineReports} reportes</span>
              </div>
            )}
            
            {stats.failedOperations > 0 && (
              <div className="flex items-center space-x-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span>{stats.failedOperations} fallidos</span>
              </div>
            )}
          </div>

          {/* Barra de progreso durante sincronización */}
          {isSyncing && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Sincronizando...</span>
                <span>{Math.round(syncProgress)}%</span>
              </div>
              <Progress value={syncProgress} className="h-1" />
            </div>
          )}

          {/* Botón de sincronización manual */}
          {isOnline && !isSyncing && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar ahora
            </Button>
          )}

          {/* Mensaje offline */}
          {!isOnline && (
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <CloudOff className="h-3 w-3" />
              <span>Se sincronizará cuando recuperes la conexión</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};