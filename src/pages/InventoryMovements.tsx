import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';

export default function InventoryMovements() {
  return (
    <div>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Movimientos de Inventario</h1>
          <p className="text-muted-foreground">
            Historial de entradas y salidas de productos
          </p>
        </div>

        <div className="text-center p-8 border-2 border-dashed border-border rounded-lg">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Movimientos</h3>
          <p className="text-muted-foreground">
            El historial de movimientos se implementará en la siguiente fase.
          </p>
        </div>
      </div>
      
      <RoleBasedNavigation />
    </div>
  );
}