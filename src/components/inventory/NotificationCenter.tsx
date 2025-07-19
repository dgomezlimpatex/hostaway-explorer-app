import { useState, useEffect } from 'react';
import { Bell, Check, X, AlertTriangle, Package } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInventoryAlerts } from '@/hooks/useInventory';
import { inventoryStorage } from '@/services/storage/inventoryStorage';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItem {
  id: string;
  type: 'stock_bajo' | 'stock_critico' | 'movement' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  productId?: string;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { data: alerts = [] } = useInventoryAlerts();
  const { toast } = useToast();

  // Convertir alertas en notificaciones
  useEffect(() => {
    const alertNotifications: NotificationItem[] = alerts
      .filter(alert => alert.is_active)
      .map(alert => ({
        id: alert.id,
        type: alert.alert_type,
        title: alert.alert_type === 'stock_critico' ? 'Stock Crítico' : 'Stock Bajo',
        message: `Producto requiere reposición urgente`,
        timestamp: new Date(alert.triggered_at),
        read: false,
        productId: alert.product_id
      }));

    setNotifications(prev => {
      // Evitar duplicados
      const existingIds = prev.map(n => n.id);
      const newNotifications = alertNotifications.filter(n => !existingIds.includes(n.id));
      return [...prev, ...newNotifications];
    });
  }, [alerts]);

  // Contar notificaciones no leídas
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const removeNotification = (notificationId: string) => {
    setNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );
  };

  const resolveAlert = async (notificationId: string) => {
    try {
      await inventoryStorage.resolveAlert(notificationId);
      removeNotification(notificationId);
      toast({
        title: "✅ Alerta resuelta",
        description: "La alerta ha sido marcada como resuelta",
      });
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "No se pudo resolver la alerta",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'stock_critico':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'stock_bajo':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Notificaciones</CardTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-6"
                >
                  Marcar todas como leídas
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No hay notificaciones
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b border-border hover:bg-muted/50 ${
                        !notification.read ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="h-2 w-2 bg-primary rounded-full" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(notification.timestamp, 'dd/MM/yyyy HH:mm', { locale: es })}
                          </p>
                          <div className="flex gap-1 mt-2">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                className="h-6 px-2 text-xs"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Marcar leída
                              </Button>
                            )}
                            {(notification.type === 'stock_bajo' || notification.type === 'stock_critico') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resolveAlert(notification.id)}
                                className="h-6 px-2 text-xs"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Resolver
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}