import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Edit, Package, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StockLevel } from '@/types/stock';

interface StockLevelTableProps {
  levels: StockLevel[];
  isLoading?: boolean;
  onCreateProduct: () => void;
  onEditProduct: (level: StockLevel) => void;
  onAdjustStock: (level: StockLevel) => void;
  onTransferStock: (level: StockLevel) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value);

export function StockLevelTable({
  levels,
  isLoading,
  onCreateProduct,
  onEditProduct,
  onAdjustStock,
  onTransferStock,
}: StockLevelTableProps) {
  const [search, setSearch] = useState('');

  const filteredLevels = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return levels;

    return levels.filter((level) => {
      const product = level.product;
      const category = product?.category;
      const warehouse = level.warehouse;
      return [product?.name, category?.name, warehouse?.name, product?.sku]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [levels, search]);

  const getStatus = (level: StockLevel) => {
    if (level.current_quantity <= 0) {
      return { label: 'Critico', variant: 'destructive' as const };
    }
    if (level.current_quantity <= level.minimum_quantity) {
      return { label: 'Bajo', variant: 'destructive' as const };
    }
    return { label: 'Correcto', variant: 'default' as const };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center">
          <Package className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock
            </CardTitle>
            <Button onClick={onCreateProduct} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por producto, categoria, almacen o SKU"
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filteredLevels.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No hay stock registrado</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Crea productos o cambia el filtro de almacen para ver resultados.
              </p>
              <Button onClick={onCreateProduct}>
                <Plus className="mr-2 h-4 w-4" />
                Crear producto
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Almacen</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Minimo</TableHead>
                    <TableHead className="text-right">Objetivo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLevels.map((level) => {
                    const status = getStatus(level);
                    const product = level.product;
                    const totalValue = level.current_quantity * (level.cost_per_unit || 0);

                    return (
                      <TableRow key={level.id}>
                        <TableCell>
                          <div className="font-medium">{product?.name || 'Producto'}</div>
                          <div className="text-xs text-muted-foreground">
                            {product?.unit_of_measure || 'unidades'}
                            {product?.sku ? ` · ${product.sku}` : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product?.category?.name || 'Sin categoria'}</Badge>
                        </TableCell>
                        <TableCell>{level.warehouse?.name || 'Almacen'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatQuantity(level.current_quantity)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatQuantity(level.minimum_quantity)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatQuantity(level.target_quantity)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            {status.variant === 'destructive' && <AlertTriangle className="h-3 w-3" />}
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(totalValue)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => onEditProduct(level)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onAdjustStock(level)}>
                              <SlidersHorizontal className="mr-2 h-4 w-4" />
                              Ajustar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onTransferStock(level)}>
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Transferir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
