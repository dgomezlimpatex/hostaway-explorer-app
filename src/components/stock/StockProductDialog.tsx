import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateStockProduct,
  useDeleteStockProduct,
  useSelectedStockWarehouse,
  useStockCategories,
  useUpdateStockProduct,
} from '@/hooks/useStock';
import type { StockItemKind, StockProduct } from '@/types/stock';

interface StockProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: StockItemKind;
  product?: StockProduct | null;
}

export function StockProductDialog({ open, onOpenChange, kind, product }: StockProductDialogProps) {
  const createProduct = useCreateStockProduct();
  const updateProduct = useUpdateStockProduct();
  const deleteProduct = useDeleteStockProduct();
  const { data: categories = [] } = useStockCategories(kind);
  const { warehouses, selectedWarehouseId } = useSelectedStockWarehouse();
  const [categoryId, setCategoryId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isEditing = !!product;

  const defaultWarehouseId = useMemo(() => {
    if (selectedWarehouseId !== 'all') return selectedWarehouseId;
    return warehouses.find((warehouse) => warehouse.is_default)?.id || warehouses[0]?.id || '';
  }, [selectedWarehouseId, warehouses]);

  const reset = () => {
    setCategoryId('');
    setWarehouseId('');
  };

  useEffect(() => {
    if (!open) return;
    setCategoryId(product?.category_id || '');
    setWarehouseId('');
  }, [open, product?.category_id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (isEditing && product) {
      await updateProduct.mutateAsync({
        id: product.id,
        updates: {
          category_id: categoryId,
          name: String(form.get('name') || ''),
          description: String(form.get('description') || '') || null,
          unit_of_measure: String(form.get('unit_of_measure') || 'unidades'),
          sku: String(form.get('sku') || '') || null,
          is_consumable: form.get('is_consumable') === 'on',
        },
      });

      reset();
      onOpenChange(false);
      return;
    }

    await createProduct.mutateAsync({
      category_id: categoryId,
      warehouse_id: warehouseId || defaultWarehouseId,
      name: String(form.get('name') || ''),
      description: String(form.get('description') || '') || null,
      unit_of_measure: String(form.get('unit_of_measure') || 'unidades'),
      sku: String(form.get('sku') || '') || null,
      is_consumable: form.get('is_consumable') === 'on',
      initial_quantity: Number(form.get('initial_quantity') || 0),
      minimum_quantity: Number(form.get('minimum_quantity') || 0),
      target_quantity: Number(form.get('target_quantity') || 0),
      cost_per_unit: form.get('cost_per_unit') ? Number(form.get('cost_per_unit')) : null,
    });

    reset();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Actualiza el nombre, tipo y datos principales del producto.'
                : 'Crea un producto en el catalogo nuevo de stock y su stock inicial.'}
            </DialogDescription>
          </DialogHeader>

          <form key={product?.id || 'new-product'} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" defaultValue={product?.name || ''} required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={categoryId} onValueChange={setCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isEditing && (
                <div className="space-y-2">
                  <Label>Almacen inicial</Label>
                  <Select value={warehouseId || defaultWarehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona almacen" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="unit_of_measure">Unidad</Label>
                <Input id="unit_of_measure" name="unit_of_measure" defaultValue={product?.unit_of_measure || 'unidades'} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU opcional</Label>
                <Input id="sku" name="sku" defaultValue={product?.sku || ''} />
              </div>
              {!isEditing && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cost_per_unit">Coste unidad</Label>
                    <Input id="cost_per_unit" name="cost_per_unit" type="number" min="0" step="0.0001" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initial_quantity">Stock inicial</Label>
                    <Input id="initial_quantity" name="initial_quantity" type="number" min="0" step="0.01" defaultValue="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimum_quantity">Stock minimo</Label>
                    <Input id="minimum_quantity" name="minimum_quantity" type="number" min="0" step="0.01" defaultValue="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_quantity">Stock objetivo</Label>
                    <Input id="target_quantity" name="target_quantity" type="number" min="0" step="0.01" defaultValue="0" />
                  </div>
                </>
              )}
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  name="is_consumable"
                  defaultChecked={product?.is_consumable ?? true}
                  className="h-4 w-4"
                />
                Descontar automaticamente si aparece en reglas de consumo
              </label>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Descripcion</Label>
                <Input id="description" name="description" defaultValue={product?.description || ''} />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {isEditing && (
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Eliminar producto
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending || !categoryId || (!isEditing && !defaultWarehouseId)}>
                  {isEditing ? 'Guardar cambios' : 'Crear producto'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara "{product?.name}" del catalogo y dejara de aparecer en todos los almacenes.
              El historico de movimientos se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteProduct.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!product) return;
                await deleteProduct.mutateAsync({ id: product.id });
                setDeleteOpen(false);
                onOpenChange(false);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
