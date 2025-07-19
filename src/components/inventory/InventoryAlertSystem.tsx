import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Package } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useInventoryAlerts } from '@/hooks/useInventory';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { InventoryAlert } from '@/types/inventory';

export function InventoryAlertSystem() {
  const { data: alerts = [], refetch } = useInventoryAlerts();
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  // Filtrar alertas activas
  const activeAlerts = alerts.filter(alert => alert.is_active);
  const criticalAlerts = activeAlerts.filter(alert => alert.alert_type === 'stock_critico');
  const lowStockAlerts = activeAlerts.filter(alert => alert.alert_type === 'stock_bajo');

  useEffect(() => {
    setUnreadCount(activeAlerts.length);
  }, [activeAlerts.length]);

  // Suscripción a tiempo real para nuevas alertas
  useEffect(() => {
    const channel = supabase
      .channel('inventory-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_alerts'
        },
        (payload) => {
          const newAlert = payload.new as InventoryAlert;
          if (newAlert.is_active) {
            toast({
              title: '⚠️ Nueva Alerta de Inventario',
              description: `${newAlert.alert_type === 'stock_critico' ? 'Stock crítico' : 'Stock bajo'} detectado`,
              variant: newAlert.alert_type === 'stock_critico' ? 'destructive' : 'default',
            });
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, refetch]);

  if (activeAlerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" />
            Alertas de Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay alertas activas
            </p>
            <Badge variant="secondary" className="mt-2">
              ✓ Todo en orden
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" />
            Alertas de Inventario
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Alertas críticas */}
        {criticalAlerts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {criticalAlerts.length} productos sin stock
                </span>
                <Badge variant="destructive">Crítico</Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Alertas de stock bajo */}
        {lowStockAlerts.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {lowStockAlerts.length} productos con stock bajo
                </span>
                <Badge variant="secondary">Atención</Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => window.location.href = '/inventory/stock'}
          >
            Ver Stock
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => window.location.href = '/inventory/reports'}
          >
            Reportes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}