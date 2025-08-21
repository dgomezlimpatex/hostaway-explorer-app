import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogisticsLayout } from "@/components/logistics/LogisticsLayout";
import { LogisticsCard } from "@/components/logistics/LogisticsCard";
import { LogisticsStatsGrid } from "@/components/logistics/LogisticsStatsGrid";
import { 
  Plus, 
  Truck,
  Package,
  Clock,
  CheckCircle2,
  Calendar,
  Building2
} from "lucide-react";

interface Delivery { 
  id: string; 
  status: string; 
  picklist_id: string | null; 
  created_at: string;
  notes?: string | null;
}

interface Picklist { 
  id: string; 
  code: string; 
  status: string; 
}

export default function LogisticsDeliveries() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [picklists, setPicklists] = useState<Picklist[]>([]);
  const [picklistId, setPicklistId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    plannedDeliveries: 0,
    inProgressDeliveries: 0,
    completedDeliveries: 0,
    todayDeliveries: 0
  });

  useEffect(() => {
    document.title = "Logística: Entregas | Operaciones";
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const [{ data: dels, error: e1 }, { data: pkls, error: e2 }] = await Promise.all([
      supabase.from("logistics_deliveries").select("id, status, picklist_id, created_at, notes").order("created_at", { ascending: false }),
      supabase.from("logistics_picklists").select("id, code, status").order("created_at", { ascending: false }),
    ]);
    
    if (e1) toast({ title: "Error cargando entregas", description: e1.message, variant: "destructive" });
    if (e2) toast({ title: "Error cargando picklists", description: e2.message, variant: "destructive" });
    
    const deliveriesData = (dels as any) || [];
    setDeliveries(deliveriesData);
    setPicklists((pkls as any) || []);
    
    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const todayDeliveries = deliveriesData.filter((d: any) => d.created_at?.startsWith(today));
    
    setStats({
      totalDeliveries: deliveriesData.length,
      plannedDeliveries: deliveriesData.filter((d: any) => d.status === 'planned').length,
      inProgressDeliveries: deliveriesData.filter((d: any) => d.status === 'in_progress').length,
      completedDeliveries: deliveriesData.filter((d: any) => d.status === 'completed').length,
      todayDeliveries: todayDeliveries.length
    });
    
    setLoading(false);
  }

  async function createDelivery() {
    if (!picklistId) {
      toast({ title: "Selecciona una picklist" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("logistics_deliveries").insert({
      picklist_id: picklistId,
      notes: notes || null,
      sede_id: "00000000-0000-0000-0000-000000000000", // TODO: Get from sede context
    });
    setLoading(false);
    if (error) {
      toast({ title: "No se pudo crear", description: error.message, variant: "destructive" });
      return;
    }
    setPicklistId("");
    setNotes("");
    toast({ title: "Entrega creada" });
    refresh();
  }

  const statsData = [
    {
      title: "Total Entregas",
      value: stats.totalDeliveries,
      icon: Truck,
      color: 'primary' as const
    },
    {
      title: "Planificadas",
      value: stats.plannedDeliveries,
      icon: Calendar,
      color: 'info' as const
    },
    {
      title: "En Progreso",
      value: stats.inProgressDeliveries,
      icon: Clock,
      color: 'warning' as const
    },
    {
      title: "Completadas",
      value: stats.completedDeliveries,
      icon: CheckCircle2,
      color: 'success' as const
    },
    {
      title: "Hoy",
      value: stats.todayDeliveries,
      icon: Calendar,
      color: 'info' as const
    }
  ];

  const getPicklistCode = (picklistId: string | null) => {
    if (!picklistId) return '-';
    const picklist = picklists.find(p => p.id === picklistId);
    return picklist ? picklist.code : picklistId;
  };

  return (
    <LogisticsLayout
      title="Gestión de Entregas"
      subtitle="Administrar entregas y logística"
      icon={Truck}
      loading={loading}
      onRefresh={refresh}
      backUrl="/logistics/dashboard"
      backLabel="Dashboard"
    >
      {/* Stats */}
      <LogisticsStatsGrid stats={statsData} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create New Delivery */}
        <Card className="shadow-lg border-0 bg-gradient-to-br from-primary/5 to-primary/2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nueva Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Picklist
              </label>
              <Select value={picklistId} onValueChange={setPicklistId}>
                <SelectTrigger className="bg-background/80 border-primary/20">
                  <SelectValue placeholder="Selecciona una picklist" />
                </SelectTrigger>
                <SelectContent>
                  {picklists.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.code}</span>
                        <span className="text-xs text-muted-foreground capitalize">• {p.status}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas (opcional)</label>
              <Input 
                placeholder="Notas de la entrega..." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background/80 border-primary/20"
              />
            </div>
            
            <Button 
              onClick={createDelivery} 
              disabled={loading || !picklistId}
              className="w-full h-11 font-medium shadow-md hover:shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" /> 
              Crear Entrega
            </Button>
          </CardContent>
        </Card>

        {/* Deliveries List */}
        <Card className="lg:col-span-2 shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Lista de Entregas ({deliveries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deliveries.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  {loading ? "Cargando entregas..." : "No hay entregas"}
                </p>
                {!loading && (
                  <p className="text-sm text-muted-foreground">
                    Crea tu primera entrega seleccionando una picklist
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {deliveries.map((delivery) => (
                  <LogisticsCard
                    key={delivery.id}
                    type="delivery"
                    id={delivery.id}
                    status={delivery.status}
                    title={`Entrega ${delivery.id.slice(0, 8)}`}
                    subtitle={`Picklist: ${getPicklistCode(delivery.picklist_id)}`}
                    notes={delivery.notes}
                    className="shadow-sm"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LogisticsLayout>
  );
}
