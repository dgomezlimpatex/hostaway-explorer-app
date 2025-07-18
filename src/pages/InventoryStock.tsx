import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { RoleBasedNavigation } from '@/components/navigation/RoleBasedNavigation';

export default function InventoryStock() {
  return (
    <div>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Stock de Inventario</h1>
          <p className="text-muted-foreground">
            Gestión y control de stock de productos
          </p>
        </div>

        <div className="text-center p-8 border-2 border-dashed border-border rounded-lg">
          <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Control de Stock</h3>
          <p className="text-muted-foreground">
            El módulo de control de stock se implementará en la siguiente fase.
          </p>
        </div>
      </div>
      
      <RoleBasedNavigation />
    </div>
  );
}