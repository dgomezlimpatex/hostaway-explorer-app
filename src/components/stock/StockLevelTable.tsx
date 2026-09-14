import { useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, ClipboardList, Edit, Package, Plus, Search, SlidersHorizontal } from 'lucide-react';
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
  onBulkSetup: () => void;
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
  onBulkSetup,
  onEditProduct,
  onAdjustStock,
  onTransferStock,
}: StockLevelTableProps) {
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const statusFilter = params.get('status') || 'all';

  const filteredLevels = useMemo(() => {
  const matchesStatus = (level: StockLevel) => statusFilter === 'empty' ? level.current_quantity <= 0 : statusFilter === 'low' ? level.current_quantity > 0 && level.current_quantity <= level.minimum_quantity : statusFilter === 'attention' ? level.current_quantity <= level.minimum_quantity : true;

    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return levels.filter(matchesStatus);

    return levels.filter(matchesStatus).filter((level) => {
      const product = level.product;
      const category = product?.category;
      const warehouse = level.warehouse;
      return [product?.name, category?.name, warehouse?.name, product?.sku]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [levels, search, statusFilter]);

  const getStatus = (level: StockLevel) => {
    if (level.current_quantity <= 0) {
      return { label: 'Sin stock', variant: 'destructive' as const };
    }
    if (level.current_quantity <= level.minimum_quantity) {
      return { label: 'Bajo', variant: 'outline' as const };
    }
    return { label: 'Correcto', variant: 'default' as const };
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="flex h-40 items-center justify-center">
          <Package className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={onBulkSetup} variant="outline" size="sm">
                <ClipboardList className="mr-2 h-4 w-4" />
                Carga operativa
              </Button>
              <Button onClick={onCreateProduct} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo producto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">{[['all', 'Todos'], ['attention', 'Necesitan reposición'], ['empty', 'Sin stock'], ['low', 'Stock bajo']].map(([value, label]) => <Button key={value} variant={statusFilter === value ? 'default' : 'outline'} size="sm" aria-pressed={statusFilter === value} onClick={() => { const next = new URLSearchParams(params); if (value === 'all') next.delete('status'); else next.set('status', value); setParams(next); }}>{label}</Button>)}</div>
          <p className="text-xs text-muted-foreground">{filteredLevels.length} de {levels.length} existencias · producto y almacén</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar existencias" placeholder="Buscar producto, categoría, almacén o SKU"
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-0">
          {filteredLevels.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">{levels.length ? 'Sin coincidencias' : 'No hay stock registrado'}</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Crea productos o cambia el filtro de almacén para ver resultados.
              </p>
              <Button onClick={onCreateProduct}>
                <Plus className="mr-2 h-4 w-4" />
                Crear producto
              </Button>
            </div>
          ) : (
            <div>
              <div className="divide-y lg:hidden">{filteredLevels.map(level => <article key={level.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{level.product?.name || 'Producto'}</h3><p className="text-xs text-muted-foreground">{level.warehouse?.name} · {level.product?.unit_of_measure}</p></div><Badge variant={getStatus(level).variant}>{getStatus(level).label}</Badge></div><div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3">{[['Actual', level.current_quantity], ['Mínimo', level.minimum_quantity], ['Objetivo', level.target_quantity]].map(([label, value]) => <div key={label}><p className="text-[10px] text-muted-foreground">{label}</p><p className="font-mono text-lg font-semibold">{formatQuantity(Number(value))}</p></div>)}</div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => onEditProduct(level)}>Editar</Button><Button size="sm" onClick={() => onAdjustStock(level)}>Ajustar</Button><Button variant="outline" size="sm" onClick={() => onTransferStock(level)}>Transferir</Button></div></article>)}</div>
              <div className="hidden overflow-x-auto lg:block"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
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
                        <TableCell>{level.warehouse?.name || 'Almacén'}</TableCell>
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
                          <Badge variant={status.variant} className={status.label === 'Bajo' ? 'gap-1 border-amber-200 bg-amber-50 text-amber-800' : 'gap-1'}>
                            {status.variant === 'destructive' && <AlertTriangle className="h-3 w-3" />}
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(totalValue)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
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
              </Table></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
