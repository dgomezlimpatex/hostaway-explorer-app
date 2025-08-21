import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';
import { useInventoryCategories, useCreateProduct, useCreateCategory, useCreateStock } from '@/hooks/useInventory';
import { useAuth } from '@/hooks/useAuth';
import type { CreateInventoryProductData, CreateInventoryCategoryData, CreateInventoryStockData } from '@/types/inventory';

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  category_id: z.string().min(1, 'La categoría es requerida'),
  unit_of_measure: z.string().min(1, 'La unidad de medida es requerida'),
  current_quantity: z.number().min(0, 'La cantidad debe ser mayor o igual a 0'),
  minimum_stock: z.number().min(0, 'El stock mínimo debe ser mayor o igual a 0'),
  maximum_stock: z.number().min(1, 'El stock máximo debe ser mayor a 0'),
  cost_per_unit: z.number().min(0, 'El costo debe ser mayor o igual a 0').optional(),
});

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;
type CategoryFormData = z.infer<typeof categorySchema>;

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateProductDialog = ({ open, onOpenChange }: CreateProductDialogProps) => {
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const { user } = useAuth();
  
  const { data: categories, isLoading: categoriesLoading } = useInventoryCategories();
  const createProduct = useCreateProduct();
  const createCategory = useCreateCategory();
  const createStock = useCreateStock();

  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      category_id: '',
      unit_of_measure: 'unidades',
      current_quantity: 0,
      minimum_stock: 1,
      maximum_stock: 100,
      cost_per_unit: 0,
    },
  });

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleCreateProduct = async (data: ProductFormData) => {
    if (!user?.id) return;

    try {
      // Create product
      const product = await createProduct.mutateAsync({
        name: data.name,
        description: data.description,
        category_id: data.category_id,
        unit_of_measure: data.unit_of_measure,
        sede_id: "00000000-0000-0000-0000-000000000000" // TODO: Get from sede context
      });

      // Create initial stock for the product
      await createStock.mutateAsync({
        product_id: product.id,
        current_quantity: data.current_quantity,
        minimum_stock: data.minimum_stock,
        maximum_stock: data.maximum_stock,
        cost_per_unit: data.cost_per_unit || undefined,
        updated_by: user.id,
        sede_id: "00000000-0000-0000-0000-000000000000" // TODO: Get from sede context
      });

      productForm.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  const handleCreateCategory = async (data: CategoryFormData) => {
    try {
      const category = await createCategory.mutateAsync({
        name: data.name!,
        description: data.description,
      });
      categoryForm.reset();
      setShowCategoryForm(false);
      
      // Select the newly created category
      productForm.setValue('category_id', category.id);
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const handleClose = () => {
    productForm.reset();
    categoryForm.reset();
    setShowCategoryForm(false);
    onOpenChange(false);
  };

  const isLoading = createProduct.isPending || createStock.isPending || createCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {showCategoryForm ? 'Nueva Categoría' : 'Nuevo Producto'}
          </DialogTitle>
        </DialogHeader>

        {showCategoryForm ? (
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(handleCreateCategory)} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la categoría</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Productos de limpieza" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descripción de la categoría..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCategoryForm(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Categoría
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit(handleCreateProduct)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={productForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Nombre del producto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Detergente multiusos" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <div className="flex gap-2">
                        <FormControl className="flex-1">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories?.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowCategoryForm(true)}
                          disabled={categoriesLoading}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="unit_of_measure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad de medida</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar unidad" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unidades">Unidades</SelectItem>
                            <SelectItem value="litros">Litros</SelectItem>
                            <SelectItem value="kilogramos">Kilogramos</SelectItem>
                            <SelectItem value="gramos">Gramos</SelectItem>
                            <SelectItem value="metros">Metros</SelectItem>
                            <SelectItem value="piezas">Piezas</SelectItem>
                            <SelectItem value="cajas">Cajas</SelectItem>
                            <SelectItem value="paquetes">Paquetes</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descripción del producto..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="current_quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad inicial</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="cost_per_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo por unidad (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="minimum_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock mínimo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={productForm.control}
                  name="maximum_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock máximo</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Producto
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};