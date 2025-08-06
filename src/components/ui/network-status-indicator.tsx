import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Wifi, WifiOff, Signal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NetworkStatusIndicatorProps {
  className?: string;
  showText?: boolean;
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  className,
  showText = false
}) => {
  const { isOnline, isSlowConnection, connectionType } = useNetworkStatus();

  const getIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4 text-destructive" />;
    }
    
    if (isSlowConnection) {
      return <Signal className="h-4 w-4 text-warning" />;
    }
    
    return <Wifi className="h-4 w-4 text-success" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Sin conexión';
    if (isSlowConnection) return 'Conexión lenta';
    return 'Conectado';
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-destructive';
    if (isSlowConnection) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {getIcon()}
      {showText && (
        <span className={cn('text-sm font-medium', getStatusColor())}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
};