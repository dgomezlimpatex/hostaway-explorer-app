import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { LogisticsLayout } from "./LogisticsLayout";
import { LogisticsStatsGrid } from "./LogisticsStatsGrid";
import { LogisticsCard } from "./LogisticsCard";
import {
  Package,
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Eye,
  Activity,
  BarChart3,
  PackagePlus,
  PackageCheck,
  Building2,
  TrendingUp,
  Users,
  Calendar
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

  const statsData = [
    {
      title: "Total Picklists",
      value: stats.totalPicklists,
      icon: Package,
      color: 'primary' as const,
      change: {
        value: 12,
        label: "vs mes anterior",
        positive: true
      }
    },
    {
      title: "En Preparación",
      value: stats.preparingPicklists,
      icon: Clock,
      color: 'warning' as const
    },
    {
      title: "Empacadas",
      value: stats.packedPicklists,
      icon: PackageCheck,
      color: 'success' as const
    },
    {
      title: "Entregas Hoy",
      value: stats.todayDeliveries,
      icon: Truck,
      color: 'info' as const
    },
    {
      title: "Completadas",
      value: stats.completedToday,
      icon: CheckCircle,
      color: 'success' as const
    },
    {
      title: "Pendientes",
      value: stats.pendingDeliveries,
      icon: AlertTriangle,
      color: 'destructive' as const
    }
  ];

  return (
    <LogisticsLayout
      title="Dashboard Logística"
      subtitle="Panel de control para operaciones logísticas"
      icon={Package}
      loading={loading}
      onRefresh={loadDashboardData}
    >

      {/* Stats Grid */}
      <LogisticsStatsGrid stats={statsData} loading={loading} />

      {/* Quick Actions */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-primary/2">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Acciones Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              asChild 
              size="lg"
              className="h-24 flex-col gap-3 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link to="/logistics/picklists">
                <PackagePlus className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Nueva Picklist</div>
                  <div className="text-xs opacity-90">Crear paquete</div>
                </div>
              </Link>
            </Button>
            
            <Button 
              asChild 
              variant="outline" 
              size="lg"
              className="h-24 flex-col gap-3 hover-lift border-primary/20 hover:border-primary/40"
            >
              <Link to="/logistics/picklists">
                <Eye className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Ver Picklists</div>
                  <div className="text-xs text-muted-foreground">Gestionar</div>
                </div>
              </Link>
            </Button>
            
            <Button 
              asChild 
              variant="outline" 
              size="lg"
              className="h-24 flex-col gap-3 hover-lift border-primary/20 hover:border-primary/40"
            >
              <Link to="/logistics/deliveries">
                <Truck className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Entregas</div>
                  <div className="text-xs text-muted-foreground">Logística</div>
                </div>
              </Link>
            </Button>
            
            <Button 
              asChild 
              variant="outline" 
              size="lg"
              className="h-24 flex-col gap-3 hover-lift border-primary/20 hover:border-primary/40"
            >
              <Link to="/logistics/reports">
                <BarChart3 className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Reportes</div>
                  <div className="text-xs text-muted-foreground">Análisis</div>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* Recent Picklists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
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
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {recentPicklists.map((picklist) => (
                  <LogisticsCard
                    key={picklist.id}
                    type="picklist"
                    id={picklist.id}
                    code={picklist.code}
                    status={picklist.status}
                    title={picklist.code}
                    subtitle={`Creada: ${new Date(picklist.created_at).toLocaleDateString('es-ES')}`}
                    scheduledDate={picklist.scheduled_date}
                    className="shadow-sm"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Overview */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Eficiencia de Empaquetado</p>
                    <p className="text-sm text-muted-foreground">Últimas 24h</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-success">94%</p>
                  <p className="text-xs text-success">+5% vs ayer</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-info/10 rounded-lg">
                    <Clock className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="font-medium">Tiempo Promedio</p>
                    <p className="text-sm text-muted-foreground">Por picklist</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">24 min</p>
                  <p className="text-xs text-success">-3 min vs ayer</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Users className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">Personal Activo</p>
                    <p className="text-sm text-muted-foreground">En turno actual</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">8</p>
                  <p className="text-xs text-muted-foreground">de 12 total</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </LogisticsLayout>
  );
};