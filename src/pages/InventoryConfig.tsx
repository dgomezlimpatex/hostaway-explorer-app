import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockLayout } from '@/components/stock/StockLayout';

export default function InventoryConfig() {
  return (
    <StockLayout
      title="Configuracion de consumo"
      description="Reglas y mappings del nuevo sistema de stock."
      showWarehouseSelect={false}
    >
      <Card>
        <CardHeader>
          <CardTitle>Fase 4 pendiente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Esta pantalla se conectara a las reglas de consumo por propiedad y producto.</p>
          <p>La base de datos ya incluye `stock_property_consumption_rules` y `stock_property_field_mappings`.</p>
        </CardContent>
      </Card>
    </StockLayout>
  );
}
