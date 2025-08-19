import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Package,
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Eye,
  Wifi,
  WifiOff,
  Activity,
  BarChart3,
  PackagePlus,
  PackageCheck
} from "lucide-react";

interface DashboardStats {
  totalPicklists: number;
  draftPicklists: number;
  preparingPicklists: number;
  packedPicklists: number;
  todayDeliveries: number;
  pendingDeliveries: number;
  completedToday: number;
}

interface RecentPicklist {
  id: string;
  code: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
}

export const LogisticsDashboard: React.FC = () => {
  const { toast } = useToast();
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalPicklists: 0,
    draftPicklists: 0,
    preparingPicklists: 0,
    packedPicklists: 0,
    todayDeliveries: 0,
    pendingDeliveries: 0,
    completedToday: 0
  });
  const [recentPicklists, setRecentPicklists] = useState<RecentPicklist[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      // Load stats
      const [picklistsResponse, deliveriesResponse] = await Promise.all([
        supabase.from("logistics_picklists").select("status"),
        supabase.from("logistics_deliveries").select("status, created_at")
      ]);

      if (picklistsResponse.data) {
        const picklists = picklistsResponse.data;
        setStats(prev => ({
          ...prev,
          totalPicklists: picklists.length,
          draftPicklists: picklists.filter(p => p.status === 'draft').length,
          preparingPicklists: picklists.filter(p => p.status === 'preparing').length,
          packedPicklists: picklists.filter(p => p.status === 'packed').length,
        }));
      }

      if (deliveriesResponse.data) {
        const today = new Date().toISOString().split('T')[0];
        const deliveries = deliveriesResponse.data;
        const todayDeliveries = deliveries.filter(d => 
          d.created_at?.startsWith(today)
        );
        
        setStats(prev => ({
          ...prev,
          todayDeliveries: todayDeliveries.length,
          pendingDeliveries: deliveries.filter(d => d.status === 'planned').length,
          completedToday: todayDeliveries.filter(d => d.status === 'completed').length
        }));
      }

      // Load recent picklists
      const recentResponse = await supabase
        .from("logistics_picklists")
        .select("id, code, status, scheduled_date, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentResponse.data) {
        setRecentPicklists(recentResponse.data);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error cargando datos",
        description: "No se pudieron cargar las estadísticas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    draft: "secondary",
    preparing: "default",
    packed: "outline",
    committed: "default",
    cancelled: "destructive"
  } as const;

  const statusLabels = {
    draft: "Borrador",
    preparing: "Preparando",
    packed: "Empacada",
    committed: "Confirmada",
    cancelled: "Cancelada"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Dashboard Logística
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Panel de control para operaciones logísticas
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              {isSlowConnection && (
                <Badge variant="outline" className="text-orange-600">
                  Conexión lenta
                </Badge>
              )}
            </p>
          </div>
          <Button 
            onClick={loadDashboardData} 
            disabled={loading}
            variant="outline"
            size={isMobile ? "sm" : "default"}
          >
            <Activity className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Button asChild variant="default" className="h-20 flex-col gap-2">
                <Link to="/logistics/picklists">
                  <PackagePlus className="h-6 w-6" />
                  <span className="text-xs text-center">Nueva Picklist</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-20 flex-col gap-2">
                <Link to="/logistics/picklists">
                  <Eye className="h-6 w-6" />
                  <span className="text-xs text-center">Ver Picklists</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-20 flex-col gap-2">
                <Link to="/logistics/deliveries">
                  <Truck className="h-6 w-6" />
                  <span className="text-xs text-center">Entregas</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-20 flex-col gap-2">
                <Link to="/logistics/reports">
                  <BarChart3 className="h-6 w-6" />
                  <span className="text-xs text-center">Reportes</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Picklists</p>
                  <p className="text-xl font-bold">{stats.totalPicklists}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Preparando</p>
                  <p className="text-xl font-bold">{stats.preparingPicklists}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <PackageCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Empacadas</p>
                  <p className="text-xl font-bold">{stats.packedPicklists}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Truck className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entregas Hoy</p>
                  <p className="text-xl font-bold">{stats.todayDeliveries}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Picklists */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Picklists Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPicklists.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay picklists recientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPicklists.map((picklist) => (
                  <div key={picklist.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{picklist.code}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(picklist.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusColors[picklist.status as keyof typeof statusColors]}>
                        {statusLabels[picklist.status as keyof typeof statusLabels]}
                      </Badge>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/logistics/picklists/${picklist.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Indicators */}
        {!isOnline && (
          <Card className="shadow-lg border-orange-200 bg-orange-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <WifiOff className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800">Modo Offline</p>
                  <p className="text-sm text-orange-600">
                    Los datos se sincronizarán cuando vuelva la conexión
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};