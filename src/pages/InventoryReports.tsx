import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockLayout } from '@/components/stock/StockLayout';

export default function InventoryReports() {
  return (
    <StockLayout
      title="Reportes de stock"
      description="Reportes del nuevo sistema profesional."
    >
      <Card>
        <CardHeader>
          <CardTitle>Reportes en preparacion</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Los reportes se conectaran al modelo `stock_*` despues de completar stock, lavanderia, amenities y consumo automatico.
        </CardContent>
      </Card>
    </StockLayout>
  );
}
