import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';

export default function InventoryReports() {
  return (
    <div>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reportes de Inventario</h1>
          <p className="text-muted-foreground">
            Análisis y reportes del inventario
          </p>
        </div>

        <div className="text-center p-8 border-2 border-dashed border-border rounded-lg">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Reportes</h3>
          <p className="text-muted-foreground">
            Los reportes de inventario se implementarán en la siguiente fase.
          </p>
        </div>
      </div>
      
      <RoleBasedNavigation />
    </div>
  );
}