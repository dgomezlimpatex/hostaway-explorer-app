import { AlertTriangle, Boxes, Building2, Package, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockLayout } from '@/components/stock/StockLayout';
import { useStockDashboardStats } from '@/hooks/useStock';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);

export default function InventoryDashboard() {
  const { stats, isLoading } = useStockDashboardStats();

  const cards = [
    { title: 'Productos', value: stats.totalProducts, icon: Package },
    { title: 'Almacenes', value: stats.totalWarehouses, icon: Building2 },
    { title: 'Stock bajo', value: stats.lowStock, icon: AlertTriangle },
    { title: 'Sin stock', value: stats.criticalStock, icon: AlertTriangle },
  ];

  return (
    <StockLayout
      title="Dashboard de stock"
      description="Resumen del nuevo sistema profesional de Lavanderia y Amenities."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '-' : card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Unidades totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? '-' : formatNumber(stats.totalUnits)}</div>
            <p className="text-sm text-muted-foreground">Suma del stock visible con el filtro actual.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Valor estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? '-' : formatCurrency(stats.totalValue)}</div>
            <p className="text-sm text-muted-foreground">Calculado con el coste unitario configurado.</p>
          </CardContent>
        </Card>
      </div>
    </StockLayout>
  );
}
