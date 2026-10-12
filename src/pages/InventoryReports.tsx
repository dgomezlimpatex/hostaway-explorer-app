import { formatMadridDate } from '@/utils/date';
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
import { buildStockReport, reorderToCsv } from '@/utils/stockReport';
import { useStockLevels, useStockMovementsRange, useStockProducts, useStockWarehouses } from '@/hooks/useStock';
import type { StockMovement, StockMovementType } from '@/types/stock';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);

const movementLabels: Record<StockMovementType, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  consumo_automatico: 'Consumo automático',
  transferencia: 'Transferencia',
};

type MovementFilter = StockMovementType | 'all';

export default function InventoryReports() {
  const today = formatMadridDate(new Date());
  const monthStart = today.slice(0, 7) + '-01';
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [movementType, setMovementType] = useState<MovementFilter>('all');
  const [productId, setProductId] = useState('all');
  const [warehouseId, setWarehouseId] = useState('all');

  const { data: movementsRange, isLoading: movementsLoading } = useStockMovementsRange(dateFrom, dateTo);
  const movements = useMemo(() => movementsRange?.movements ?? [], [movementsRange]);
  const { data: levels = [] } = useStockLevels();
  const { data: products = [] } = useStockProducts();
  const { data: warehouses = [] } = useStockWarehouses();

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      if (movementType !== 'all' && movement.movement_type !== movementType) return false;
      if (productId !== 'all' && movement.product_id !== productId) return false;
      if (warehouseId !== 'all' && movement.warehouse_id !== warehouseId && movement.to_warehouse_id !== warehouseId) return false;
      return true;
    });
  }, [movementType, movements, productId, warehouseId]);

  const report = useMemo(() => buildStockReport(filteredMovements, levels), [filteredMovements, levels]);

  const totalExitValue = report.consumptionByProduct.reduce((sum, item) => sum + item.value, 0);
  const totalReorderValue = report.reorder.reduce((sum, item) => sum + item.estimatedCost, 0);

  const exportRows = filteredMovements.map((movement) => ({
    fecha: new Date(movement.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
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

  const exportReorderCsv = () => {
    const blob = new Blob(['﻿' + reorderToCsv(report.reorder)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stock-reposicion-${today}.csv`;
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
    }))), 'Reposición');
    XLSX.writeFile(workbook, `stock-reporte-${dateFrom}-${dateTo}.xlsx`);
  };

  return (
    <StockLayout
      title="Informes de inventario"
      description="Consumo, movimientos, bajo mínimo y reposición estimada."
      showWarehouseSelect={false}
    >
      <div className="space-y-4"><p className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">Movimientos del rango elegido, por días completos en horario de Madrid. El valor de los consumos usa el coste guardado en cada movimiento cuando existe y, si no, el coste actual del producto. La reposición refleja las existencias actuales.</p>
        {movementsRange?.truncated && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">El rango tiene demasiados movimientos y el informe está incompleto: acorta las fechas para ver todos.</p>}
        {dateFrom > dateTo && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">La fecha «Desde» es posterior a «Hasta».</p>}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <Input aria-label="Desde" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input aria-label="Hasta" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <Select value={movementType} onValueChange={(value) => setMovementType(value as MovementFilter)}>
              <SelectTrigger aria-label="Tipo"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los movimientos</SelectItem>
                {Object.entries(movementLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger aria-label="Producto"><SelectValue placeholder="Producto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los productos</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger aria-label="Almacén"><SelectValue placeholder="Almacén" /></SelectTrigger>
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
          <Metric title="Bajo mínimo" value={report.lowStock.length} icon={TrendingDown} />
          <Metric title="Valor reposición" value={formatCurrency(totalReorderValue)} icon={WalletCards} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-2xl border-border/60 shadow-sm">
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

          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Reposición sugerida</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.reorder.length === 0 ? 'Todo en objetivo' : `${report.reorder.length > 12 ? 'Mostrando 12 de ' : ''}${report.reorder.length} productos · ${formatCurrency(totalReorderValue)} estimados`}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={exportReorderCsv} disabled={report.reorder.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Lista CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <SimpleTable
                emptyText="No hay productos por debajo de objetivo."
                headers={['Producto', 'Almacén', 'Reponer', 'Coste']}
                rows={report.reorder.slice(0, 12).map((item) => [
                  item.level.product?.name || 'Producto',
                  item.level.warehouse?.name || 'Almacén',
                  formatQuantity(item.needed),
                  formatCurrency(item.estimatedCost),
                ])}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/60 shadow-sm">
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
                    <TableHead>Almacén</TableHead>
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
                          {movement.warehouse?.name || 'Almacén'}
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
    <Card className="rounded-2xl border-border/60 shadow-sm">
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
