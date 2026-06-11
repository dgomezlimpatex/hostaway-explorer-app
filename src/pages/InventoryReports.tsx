import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, PackageCheck, TrendingDown, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StockLayout } from '@/components/stock/StockLayout';
import { useStockLevels, useStockMovements, useStockProducts, useStockWarehouses } from '@/hooks/useStock';
import type { StockMovement, StockMovementType } from '@/types/stock';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);

const movementLabels: Record<StockMovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  consumo_automatico: 'Consumo automatico',
  transferencia: 'Transferencia',
};

type MovementFilter = StockMovementType | 'all';

export default function InventoryReports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [movementType, setMovementType] = useState<MovementFilter>('all');
  const [productId, setProductId] = useState('all');
  const [warehouseId, setWarehouseId] = useState('all');

  const { data: movements = [], isLoading: movementsLoading } = useStockMovements(1000);
  const { data: levels = [] } = useStockLevels();
  const { data: products = [] } = useStockProducts();
  const { data: warehouses = [] } = useStockWarehouses();

  const filteredMovements = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return movements.filter((movement) => {
      const createdAt = new Date(movement.created_at);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;
      if (movementType !== 'all' && movement.movement_type !== movementType) return false;
      if (productId !== 'all' && movement.product_id !== productId) return false;
      if (warehouseId !== 'all' && movement.warehouse_id !== warehouseId && movement.to_warehouse_id !== warehouseId) return false;
      return true;
    });
  }, [dateFrom, dateTo, movementType, movements, productId, warehouseId]);

  const report = useMemo(() => {
    const automaticConsumption = filteredMovements.filter((movement) => movement.movement_type === 'consumo_automatico');
    const exits = filteredMovements.filter((movement) => movement.movement_type === 'salida' || movement.movement_type === 'consumo_automatico');
    const entries = filteredMovements.filter((movement) => movement.movement_type === 'entrada');
    const lowStock = levels.filter((level) => level.current_quantity <= level.minimum_quantity);
    const reorder = levels
      .map((level) => ({
        level,
        needed: Math.max(0, level.target_quantity - level.current_quantity),
        estimatedCost: Math.max(0, level.target_quantity - level.current_quantity) * (level.cost_per_unit || 0),
      }))
      .filter((item) => item.needed > 0)
      .sort((a, b) => b.needed - a.needed);

    const consumptionByProduct = new Map<string, { product: string; quantity: number; value: number }>();
    exits.forEach((movement) => {
      const key = movement.product_id;
      const current = consumptionByProduct.get(key) || {
        product: movement.product?.name || 'Producto',
        quantity: 0,
        value: 0,
      };
      current.quantity += movement.quantity;
      current.value += movement.quantity * (movement.product ? (levels.find((level) => level.product_id === movement.product_id)?.cost_per_unit || 0) : 0);
      consumptionByProduct.set(key, current);
    });

    return {
      automaticConsumption,
      exits,
      entries,
      lowStock,
      reorder,
      consumptionByProduct: [...consumptionByProduct.values()].sort((a, b) => b.quantity - a.quantity),
    };
  }, [filteredMovements, levels]);

  const totalExitValue = report.consumptionByProduct.reduce((sum, item) => sum + item.value, 0);
  const totalReorderValue = report.reorder.reduce((sum, item) => sum + item.estimatedCost, 0);

  const exportRows = filteredMovements.map((movement) => ({
    fecha: new Date(movement.created_at).toLocaleString('es-ES'),
    producto: movement.product?.name || '',
    tipo: movementLabels[movement.movement_type],
    almacen_origen: movement.warehouse?.name || '',
    almacen_destino: movement.to_warehouse?.name || '',
    cantidad: movement.quantity,
    antes: movement.previous_quantity,
    despues: movement.new_quantity,
    motivo: movement.reason,
  }));

  const exportCsv = () => {
    const headers = Object.keys(exportRows[0] || {
      fecha: '',
      producto: '',
      tipo: '',
      almacen_origen: '',
      almacen_destino: '',
      cantidad: '',
      antes: '',
      despues: '',
      motivo: '',
    });
    const csv = [
      headers.join(';'),
      ...exportRows.map((row) => headers.map((header) => `"${String(row[header as keyof typeof row] ?? '').replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-movimientos-${dateFrom}-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), 'Movimientos');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.reorder.map((item) => ({
      producto: item.level.product?.name || '',
      almacen: item.level.warehouse?.name || '',
      actual: item.level.current_quantity,
      minimo: item.level.minimum_quantity,
      objetivo: item.level.target_quantity,
      reponer: item.needed,
      coste_estimado: item.estimatedCost,
    }))), 'Reposicion');
    XLSX.writeFile(workbook, `stock-reporte-${dateFrom}-${dateTo}.xlsx`);
  };

  return (
    <StockLayout
      title="Reportes de stock"
      description="Consumo, movimientos, bajo minimo y reposicion estimada."
      showWarehouseSelect={false}
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-6">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <Select value={movementType} onValueChange={(value) => setMovementType(value as MovementFilter)}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los movimientos</SelectItem>
                {Object.entries(movementLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Producto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los productos</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Almacen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los almacenes</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={exportCsv} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button type="button" variant="outline" onClick={exportXlsx} className="flex-1">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                XLSX
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric title="Movimientos" value={filteredMovements.length} icon={PackageCheck} />
          <Metric title="Consumos auto" value={report.automaticConsumption.length} icon={TrendingDown} />
          <Metric title="Bajo minimo" value={report.lowStock.length} icon={TrendingDown} />
          <Metric title="Valor reposicion" value={formatCurrency(totalReorderValue)} icon={WalletCards} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Consumo por producto</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleTable
                emptyText="No hay salidas ni consumos en el rango seleccionado."
                headers={['Producto', 'Cantidad', 'Valor']}
                rows={report.consumptionByProduct.slice(0, 12).map((item) => [
                  item.product,
                  formatQuantity(item.quantity),
                  formatCurrency(item.value),
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reposicion sugerida</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleTable
                emptyText="No hay productos por debajo de objetivo."
                headers={['Producto', 'Almacen', 'Reponer', 'Coste']}
                rows={report.reorder.slice(0, 12).map((item) => [
                  item.level.product?.name || 'Producto',
                  item.level.warehouse?.name || 'Almacen',
                  formatQuantity(item.needed),
                  formatCurrency(item.estimatedCost),
                ])}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Movimientos recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Almacen</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementsLoading ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">Cargando movimientos...</TableCell></TableRow>
                  ) : filteredMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No hay movimientos para los filtros actuales.</TableCell></TableRow>
                  ) : (
                    filteredMovements.slice(0, 80).map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{new Date(movement.created_at).toLocaleString('es-ES')}</TableCell>
                        <TableCell>{movement.product?.name || 'Producto'}</TableCell>
                        <TableCell><Badge variant="outline">{movementLabels[movement.movement_type]}</Badge></TableCell>
                        <TableCell>
                          {movement.warehouse?.name || 'Almacen'}
                          {movement.to_warehouse ? ` -> ${movement.to_warehouse.name}` : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatQuantity(movement.quantity)}</TableCell>
                        <TableCell>{movement.reason}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="text-right text-sm text-muted-foreground">
          Valor estimado de salidas filtradas: <strong>{formatCurrency(totalExitValue)}</strong>
        </div>
      </div>
    </StockLayout>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function SimpleTable({
  headers,
  rows,
  emptyText,
}: {
  headers: string[];
  rows: string[][];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, cellIndex) => (
                <TableCell key={`${index}-${cellIndex}`}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
