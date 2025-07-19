import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart3, Package } from "lucide-react";
import { useInventoryMovements, useInventoryStock } from '@/hooks/useInventory';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useMemo } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

export function InventoryAnalytics() {
  const { data: movements = [] } = useInventoryMovements(50);
  const { data: stock = [] } = useInventoryStock();

  // Datos para gráfico de movimientos por día (últimos 7 días)
  const movementsByDay = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: startOfDay(date),
        dateStr: format(date, 'dd/MM', { locale: es }),
        inbound: 0,
        outbound: 0,
        total: 0
      };
    });

    movements.forEach(movement => {
      const movementDate = startOfDay(new Date(movement.created_at));
      const dayData = last7Days.find(day => 
        day.date.getTime() === movementDate.getTime()
      );
      
      if (dayData) {
        if (movement.movement_type === 'entrada') {
          dayData.inbound += movement.quantity;
        } else {
          dayData.outbound += movement.quantity;
        }
        dayData.total += Math.abs(movement.quantity);
      }
    });

    return last7Days;
  }, [movements]);

  // Top productos por movimientos
  const topProductsByMovements = useMemo(() => {
    const productMovements = movements.reduce((acc, movement) => {
      const productName = movement.product?.name || 'Producto desconocido';
      if (!acc[productName]) {
        acc[productName] = 0;
      }
      acc[productName] += Math.abs(movement.quantity);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(productMovements)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));
  }, [movements]);

  // Distribución de stock por categorías
  const stockByCategory = useMemo(() => {
    const categoryStock = stock.reduce((acc, item) => {
      const categoryName = item.product?.category?.name || 'Sin categoría';
      if (!acc[categoryName]) {
        acc[categoryName] = {
          total: 0,
          low: 0,
          critical: 0
        };
      }
      
      acc[categoryName].total += item.current_quantity;
      if (item.current_quantity <= item.minimum_stock) {
        if (item.current_quantity === 0) {
          acc[categoryName].critical++;
        } else {
          acc[categoryName].low++;
        }
      }
      
      return acc;
    }, {} as Record<string, { total: number; low: number; critical: number }>);

    return Object.entries(categoryStock).map(([name, data]) => ({
      name,
      ...data
    }));
  }, [stock]);

  // Métricas rápidas
  const totalMovementsLastWeek = movementsByDay.reduce((sum, day) => sum + day.total, 0);
  const avgMovementsPerDay = Math.round(totalMovementsLastWeek / 7);
  const totalStockValue = stock.reduce((sum, item) => {
    return sum + (item.current_quantity * (item.cost_per_unit || 0));
  }, 0);

  return (
    <div className="space-y-6">
      {/* Métricas rápidas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Movimientos esta semana
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{totalMovementsLastWeek}</p>
                  <Badge variant="secondary">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {avgMovementsPerDay}/día
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Valor total del stock
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    €{totalStockValue.toFixed(2)}
                  </p>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Productos únicos
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{stock.length}</p>
                  <Badge variant="outline">
                    {stock.filter(s => s.current_quantity > 0).length} en stock
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Movimientos por día */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Movimientos de Inventario (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={movementsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateStr" />
                <YAxis />
                <Tooltip 
                  labelFormatter={(label) => `Fecha: ${label}`}
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'inbound' ? 'Entradas' : 
                    name === 'outbound' ? 'Salidas' : 'Total'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="inbound" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="inbound"
                />
                <Line 
                  type="monotone" 
                  dataKey="outbound" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  name="outbound"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top productos por movimientos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Productos por Actividad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProductsByMovements} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip 
                  formatter={(value: number) => [value, 'Movimientos']}
                />
                <Bar 
                  dataKey="quantity" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stock por categorías */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Estado del Stock por Categorías
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stockByCategory.map((category) => (
              <div key={category.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{category.name}</span>
                  <div className="flex gap-2">
                    {category.critical > 0 && (
                      <Badge variant="destructive">{category.critical} críticos</Badge>
                    )}
                    {category.low > 0 && (
                      <Badge variant="secondary">{category.low} bajo stock</Badge>
                    )}
                    <Badge variant="outline">{category.total} unidades</Badge>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ 
                      width: `${Math.min(100, (category.total / Math.max(...stockByCategory.map(c => c.total))) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}