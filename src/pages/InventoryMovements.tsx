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
  consumo_automatico: 'Consumo automatico',
  transferencia: 'Transferencia',
};

export default function InventoryMovements() {
  const { data: movements = [], isLoading } = useStockMovements(150);

  return (
    <StockLayout
      title="Movimientos"
      description="Historial de entradas, salidas, ajustes, consumos y transferencias."
      showWarehouseSelect={false}
    >
      <Card>
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
                  <TableHead className="text-right">Antes</TableHead>
                  <TableHead className="text-right">Despues</TableHead>
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
                ) : movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No hay movimientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{new Date(movement.created_at).toLocaleString('es-ES')}</TableCell>
                      <TableCell>{movement.product?.name || 'Producto'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{movementLabels[movement.movement_type]}</Badge>
                      </TableCell>
                      <TableCell>
                        {movement.warehouse?.name || 'Almacen'}
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
