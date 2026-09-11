import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StockLayout } from '@/components/stock/StockLayout';
import { useStockMovements } from '@/hooks/useStock';

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);

const movementLabels: Record<string, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste',
  consumo_automatico: 'Consumo automático',
  transferencia: 'Transferencia',
};

export default function InventoryMovements() {
  const { data: movements = [], isLoading } = useStockMovements(150);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const filtered = movements.filter(item => (type === 'all' || item.movement_type === type) && [item.product?.name, item.warehouse?.name, item.to_warehouse?.name, item.reason].some(value => value?.toLowerCase().includes(search.toLowerCase())));
  return (
    <StockLayout
      title="Movimientos"
      description="Historial de entradas, salidas, ajustes, consumos y transferencias."
      showWarehouseSelect={false}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-background p-4"><Input className="w-full sm:max-w-sm" aria-label="Buscar movimientos" placeholder="Buscar producto, almacén o motivo…" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Tipo de movimiento" className="h-10 rounded-xl border bg-background px-3 text-sm" value={type} onChange={event => setType(event.target.value)}><option value="all">Todos los tipos</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Button variant="ghost" onClick={() => { setSearch(''); setType('all'); }}>Limpiar filtros</Button><p className="w-full text-xs text-muted-foreground">{filtered.length} resultados en los últimos 150 movimientos de la sede</p></div>
      <Card className="rounded-2xl border-border/60 shadow-sm">
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
                  <TableHead className="text-right">Antes</TableHead>
                  <TableHead className="text-right">Después</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      Cargando movimientos...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No hay movimientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{new Date(movement.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</TableCell>
                      <TableCell>{movement.product?.name || 'Producto'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{movementLabels[movement.movement_type]}</Badge>
                      </TableCell>
                      <TableCell>
                        {movement.warehouse?.name || 'Almacén'}
                        {movement.to_warehouse ? ` -> ${movement.to_warehouse.name}` : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatQuantity(movement.quantity)}</TableCell>
                      <TableCell className="text-right font-mono">{formatQuantity(movement.previous_quantity)}</TableCell>
                      <TableCell className="text-right font-mono">{formatQuantity(movement.new_quantity)}</TableCell>
                      <TableCell>{movement.reason}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </StockLayout>
  );
}
