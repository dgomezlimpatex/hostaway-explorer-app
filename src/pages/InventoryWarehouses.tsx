import { FormEvent, useState } from 'react';
import { Building2, Edit, Plus } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StockLayout } from '@/components/stock/StockLayout';
import {
  useCreateStockWarehouse,
  useDeleteStockWarehouse,
  useStockWarehouses,
  useUpdateStockWarehouse,
} from '@/hooks/useStock';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import type { StockWarehouse } from '@/types/stock';

export default function InventoryWarehouses() {
  const { hasPermission } = useRolePermissions();
  const canCreateWarehouse = hasPermission('inventory', 'canCreate');
  const canEditWarehouse = hasPermission('inventory', 'canEdit');
  const { data: warehouses = [], isLoading } = useStockWarehouses();
  const createWarehouse = useCreateStockWarehouse();
  const updateWarehouse = useUpdateStockWarehouse();
  const deleteWarehouse = useDeleteStockWarehouse();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const visibleWarehouses = warehouses.filter(warehouse => [warehouse.name, warehouse.address].some(value => value?.toLowerCase().includes(search.toLowerCase())));
  const [warehouseToEdit, setWarehouseToEdit] = useState<StockWarehouse | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openCreateDialog = () => {
    setWarehouseToEdit(null);
    setDialogOpen(true);
  };

  const openEditDialog = (warehouse: StockWarehouse) => {
    setWarehouseToEdit(warehouse);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') || ''),
      address: String(form.get('address') || '') || null,
      is_default: form.get('is_default') === 'on',
    };

    if (warehouseToEdit) {
      await updateWarehouse.mutateAsync({
        id: warehouseToEdit.id,
        updates: payload,
      });
    } else {
      await createWarehouse.mutateAsync(payload);
    }

    setDialogOpen(false);
    setWarehouseToEdit(null);
  };

  return (
    <StockLayout
      title="Almacenes"
      description="Gestiona almacenes por sede y define el almacén principal."
      showWarehouseSelect={false}
      actions={
        canCreateWarehouse ? (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo almacén
          </Button>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background p-4"><div><p className="text-sm font-semibold">{warehouses.length} almacenes en la sede</p><p className="mt-1 text-xs text-muted-foreground">El principal se utiliza como almacén predeterminado.</p></div><Input className="sm:w-72" aria-label="Buscar almacenes" placeholder="Buscar por nombre o dirección…" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Almacenes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Cargando almacenes...
                  </TableCell>
                </TableRow>
              ) : visibleWarehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No hay almacenes configurados.
                  </TableCell>
                </TableRow>
              ) : (
                visibleWarehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>{warehouse.address || '-'}</TableCell>
                    <TableCell>{warehouse.is_default ? 'Sí' : '—'}</TableCell>
                    <TableCell>{warehouse.is_active ? 'Activo' : 'Inactivo'}</TableCell>
                    <TableCell className="text-right">
                      {canEditWarehouse && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(warehouse)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          {!warehouse.is_default && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateWarehouse.mutate({ id: warehouse.id, updates: { is_default: true } })}
                            >
                              Hacer principal
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setWarehouseToEdit(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{warehouseToEdit ? 'Editar almacén' : 'Nuevo almacén'}</DialogTitle>
          </DialogHeader>
          <form key={warehouseToEdit?.id || 'new-warehouse'} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" defaultValue={warehouseToEdit?.name || ''} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" name="address" defaultValue={warehouseToEdit?.address || ''} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="is_default" type="checkbox" className="h-4 w-4" defaultChecked={warehouseToEdit?.is_default || false} />
              Marcar como almacén principal
            </label>
            <DialogFooter className="gap-2 sm:justify-between">
              {warehouseToEdit && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={warehouseToEdit.is_default}
                  onClick={() => setDeleteOpen(true)}
                >
                  Eliminar almacén
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createWarehouse.isPending || updateWarehouse.isPending}>
                  {warehouseToEdit ? 'Guardar cambios' : 'Crear almacén'}
                </Button>
              </div>
            </DialogFooter>
            {warehouseToEdit?.is_default && (
              <p className="text-xs text-muted-foreground">
                Para eliminar este almacén, marca antes otro almacén como principal.
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar almacén</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara "{warehouseToEdit?.name}" de las vistas activas. El historico y los movimientos se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteWarehouse.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!warehouseToEdit) return;
                await deleteWarehouse.mutateAsync({ id: warehouseToEdit.id });
                setDeleteOpen(false);
                setDialogOpen(false);
                setWarehouseToEdit(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StockLayout>
  );
}
