import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';
import { InventoryDashboardWidget } from '@/components/inventory/InventoryDashboardWidget';
import { InventoryAlertSystem } from '@/components/inventory/InventoryAlertSystem';
import { InventoryAnalytics } from '@/components/inventory/InventoryAnalytics';
import { InventoryPredictions } from '@/components/inventory/InventoryPredictions';
import { InventoryExportUtils } from '@/components/inventory/InventoryExportUtils';

export default function InventoryDashboard() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Inventario</h1>
          <p className="text-muted-foreground">
            Análisis completo y gestión del inventario
          </p>
        </div>
        <InventoryExportUtils />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
          <TabsTrigger value="predictions">Predicciones</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <InventoryDashboardWidget />
            <InventoryAlertSystem />
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <InventoryAnalytics />
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <InventoryPredictions />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="max-w-2xl mx-auto">
            <InventoryAlertSystem />
          </div>
        </TabsContent>
      </Tabs>
      
      <RoleBasedNavigation />
    </div>
  );
}