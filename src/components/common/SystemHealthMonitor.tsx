import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';

interface SystemHealth {
  isOnline: boolean;
  hasSedeAccess: boolean;
  queryCacheSize: number;
  lastSedeRefresh?: Date;
  errors: string[];
}

export const SystemHealthMonitor = () => {
  const [health, setHealth] = useState<SystemHealth>({
    isOnline: navigator.onLine,
    hasSedeAccess: false,
    queryCacheSize: 0,
    errors: []
  });
  
  const queryClient = useQueryClient();
  const { availableSedes, loading } = useSede();
  const { user, isLoading: authLoading } = useAuth();
  const [showHealthBar, setShowHealthBar] = useState(false);

  useEffect(() => {
    const updateHealth = () => {
      const errors: string[] = [];
      
      // Check network connectivity
      if (!navigator.onLine) {
        errors.push('Sin conexión a internet');
      }

      // Check sede access after loading
      const hasSedeAccess = !loading && !authLoading && availableSedes.length > 0;
      if (!loading && !authLoading && user && availableSedes.length === 0) {
        errors.push('Sin acceso a sedes');
      }

      // Check query cache size (warn if too large)
      const cache = queryClient.getQueryCache();
      const cacheSize = cache.getAll().length;
      if (cacheSize > 100) {
        errors.push(`Cache grande (${cacheSize} queries)`);
      }

      setHealth({
        isOnline: navigator.onLine,
        hasSedeAccess,
        queryCacheSize: cacheSize,
        lastSedeRefresh: new Date(),
        errors
      });

      // Only show health bar if there are issues
      setShowHealthBar(errors.length > 0);
    };

    // Initial check
    updateHealth();

    // Listen for online/offline events
    const handleOnline = () => updateHealth();
    const handleOffline = () => updateHealth();
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Periodic health check
    const interval = setInterval(updateHealth, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [queryClient, availableSedes, loading, authLoading, user]);

  if (!showHealthBar) {
    return null;
  }

  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {health.isOnline ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm">
              {health.isOnline ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
          
          {health.errors.length > 0 && (
            <div className="text-sm">
              Problemas detectados: {health.errors.join(', ')}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};