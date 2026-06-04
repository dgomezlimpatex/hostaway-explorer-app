import { FormEvent, useEffect, useState } from 'react';
import { Edit, FolderKanban, Plus, Trash2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateStockCategory,
  useDeleteStockCategory,
  useStockCategories,
  useUpdateStockCategory,
} from '@/hooks/useStock';
import type { StockCategory, StockItemKind } from '@/types/stock';

interface StockCategoryManagerProps {
  kind: StockItemKind;
}

const kindLabel: Record<StockItemKind, string> = {
  amenity: 'amenities',
  laundry: 'lavanderia',
  other: 'otros',
};

export function StockCategoryManager({ kind }: StockCategoryManagerProps) {
  const { data: categories = [], isLoading } = useStockCategories(kind);
  const createCategory = useCreateStockCategory();
  const updateCategory = useUpdateStockCategory();
  const deleteCategory = useDeleteStockCategory();
  const [managerOpen, setManagerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<StockCategory | null>(null);

  const openCreate = () => {
    setEditingCategory(null);
    setFormOpen(true);
  };

  const openEdit = (category: StockCategory) => {
    setEditingCategory(category);
    setFormOpen(true);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setManagerOpen(true)}>
        <FolderKanban className="mr-2 h-4 w-4" />
        Gestionar tipos
      </Button>

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tipos de {kindLabel[kind]}</DialogTitle>
            <DialogDescription>
              Crea, edita o elimina los tipos que usas para organizar el catalogo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo tipo
              </Button>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando tipos...</p>
            ) : categories.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Todavia no hay tipos. Crea el primero para clasificar tus productos.
              </div>
            ) : (
              <div className="divide-y rounded-md border">
                {categories.map((category) => (
                  <div key={category.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">{category.name}</div>
                      {category.description && (
                        <div className="text-sm text-muted-foreground">{category.description}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(category)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setDeletingCategory(category)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StockCategoryDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        kind={kind}
        category={editingCategory}
        isSaving={createCategory.isPending || updateCategory.isPending}
        onSubmit={async (values) => {
          if (editingCategory) {
            await updateCategory.mutateAsync({ id: editingCategory.id, updates: values });
          } else {
            await createCategory.mutateAsync({ ...values, kind });
          }
          setFormOpen(false);
          setEditingCategory(null);
        }}
      />

      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tipo</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara el tipo "{deletingCategory?.name}". Si tiene productos activos asignados, la app no lo borrara y te pedira reasignarlos primero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteCategory.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!deletingCategory) return;
                await deleteCategory.mutateAsync({ id: deletingCategory.id, kind });
                setDeletingCategory(null);
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

interface StockCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: StockItemKind;
  category: StockCategory | null;
  isSaving: boolean;
  onSubmit: (values: { name: string; description: string | null; sort_order: number }) => Promise<void>;
}

function StockCategoryDialog({
  open,
  onOpenChange,
  kind,
  category,
  isSaving,
  onSubmit,
}: StockCategoryDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const isEditing = !!category;

  useEffect(() => {
    if (!open) return;
    setName(category?.name || '');
    setDescription(category?.description || '');
    setSortOrder(String(category?.sort_order ?? 0));
  }, [category, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      name,
      description: description.trim() || null,
      sort_order: Number(sortOrder || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar tipo' : 'Nuevo tipo'}</DialogTitle>
          <DialogDescription>
            Define los tipos que quieres usar para organizar {kindLabel[kind]}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Nombre</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={kind === 'amenity' ? 'Ej. Cocina, Bano, Bienvenida' : 'Ej. Sabanas, Toallas, Fundas'}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Descripcion</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-sort-order">Orden</Label>
            <Input
              id="category-sort-order"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              type="number"
              step="1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isEditing ? 'Guardar cambios' : 'Crear tipo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
