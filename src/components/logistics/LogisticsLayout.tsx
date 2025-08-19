import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, 
  Package, 
  RefreshCw,
  Wifi,
  WifiOff
} from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface LogisticsLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  onRefresh?: () => void;
  backUrl?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const LogisticsLayout: React.FC<LogisticsLayoutProps> = ({
  children,
  title,
  subtitle,
  icon: Icon = Package,
  loading = false,
  onRefresh,
  backUrl = "/",
  backLabel = "Dashboard",
  actions,
  className
}) => {
  const { isOnline, isSlowConnection } = useNetworkStatus();

  return (
    <div className={cn("min-h-screen bg-gradient-to-br from-background via-background to-muted/20", className)}>
      <div className="container-responsive py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Back Navigation */}
            <Button variant="ghost" size="sm" asChild>
              <Link to={backUrl} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Title Section */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
                <Icon className="h-6 w-6 text-primary flex-shrink-0" />
                <span className="truncate">{title}</span>
              </h1>
              
              {subtitle && (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                  
                  {/* Network Status */}
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-success" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-destructive" />
                  )}
                  
                  {isSlowConnection && (
                    <Badge variant="outline" className="text-warning text-xs">
                      Conexión lenta
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onRefresh && (
              <Button 
                onClick={onRefresh} 
                disabled={loading}
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
            )}
            {actions}
          </div>
        </div>

        {/* Offline Warning */}
        {!isOnline && (
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-warning flex-shrink-0" />
              <div>
                <p className="font-medium text-warning-foreground">Modo Offline</p>
                <p className="text-sm text-warning-foreground/80">
                  Los cambios se sincronizarán cuando vuelva la conexión
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};