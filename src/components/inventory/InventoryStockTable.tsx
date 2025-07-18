import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Edit,
  Package,
  Plus,
  Search,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryStockWithProduct } from '@/types/inventory';

interface InventoryStockTableProps {
  stock: InventoryStockWithProduct[];
  isLoading?: boolean;
  onEditStock: (stockItem: InventoryStockWithProduct) => void;
  onCreateProduct: () => void;
  onAdjustStock: (stockItem: InventoryStockWithProduct) => void;
}

export const InventoryStockTable = ({
  stock,
  isLoading,
  onEditStock,
  onCreateProduct,
  onAdjustStock
}: InventoryStockTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Filter stock based on search and category
  const filteredStock = stock.filter(item => {
    const matchesSearch = item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.product.category?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.product.category_id === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter
  const categories = Array.from(
    new Set(stock.map(item => item.product.category).filter(Boolean))
  );

  // Get stock status
  const getStockStatus = (item: InventoryStockWithProduct) => {
    if (item.current_quantity <= 0) {
      return { status: 'sin-stock', label: 'Sin Stock', variant: 'destructive' as const };
    }
    if (item.current_quantity <= item.minimum_stock) {
      return { status: 'stock-bajo', label: 'Stock Bajo', variant: 'destructive' as const };
    }
    if (item.current_quantity <= item.minimum_stock * 1.5) {
      return { status: 'stock-medio', label: 'Stock Medio', variant: 'secondary' as const };
    }
    return { status: 'stock-alto', label: 'Stock Bueno', variant: 'default' as const };
  };

  // Format currency
  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <Package className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock de Inventario
            </CardTitle>
            <Button onClick={onCreateProduct} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground"
            >
              <option value="">Todas las categorías</option>
              {categories.map(category => (
                <option key={category?.id} value={category?.id}>
                  {category?.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Stock table */}
      <Card>
        <CardContent className="p-0">
          {filteredStock.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay productos en stock
              </h3>
              <p className="text-muted-foreground mb-4">
                Comienza agregando productos a tu inventario
              </p>
              <Button onClick={onCreateProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Producto
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Stock Actual</TableHead>
                  <TableHead>Min/Max</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Costo/Unidad</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const totalValue = item.current_quantity * (item.cost_per_unit || 0);
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.product.name}</div>
                          {item.product.description && (
                            <div className="text-sm text-muted-foreground">
                              {item.product.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {item.product.unit_of_measure}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {item.product.category?.name || 'Sin categoría'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg">
                            {item.current_quantity}
                          </span>
                          {item.current_quantity <= item.minimum_stock && (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {item.minimum_stock}
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {item.maximum_stock}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stockStatus.variant}>
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.cost_per_unit)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {formatCurrency(totalValue)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditStock(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAdjustStock(item)}
                          >
                            Ajustar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      {filteredStock.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Productos</div>
              <div className="text-2xl font-bold">{filteredStock.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Stock Bajo</div>
              <div className="text-2xl font-bold text-destructive">
                {filteredStock.filter(item => 
                  item.current_quantity <= item.minimum_stock
                ).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Sin Stock</div>
              <div className="text-2xl font-bold text-destructive">
                {filteredStock.filter(item => item.current_quantity <= 0).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Valor Total</div>
              <div className="text-2xl font-bold">
                {formatCurrency(
                  filteredStock.reduce((total, item) => 
                    total + (item.current_quantity * (item.cost_per_unit || 0)), 0
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};