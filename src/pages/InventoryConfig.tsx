import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';

export default function InventoryConfig() {
  return (
    <div>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuración de Inventario</h1>
          <p className="text-muted-foreground">
            Configuración de consumos automáticos y alertas
          </p>
        </div>

        <div className="text-center p-8 border-2 border-dashed border-border rounded-lg">
          <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Configuración</h3>
          <p className="text-muted-foreground">
            Las opciones de configuración se implementarán en la siguiente fase.
          </p>
        </div>
      </div>
      
      <RoleBasedNavigation />
    </div>
  );
}