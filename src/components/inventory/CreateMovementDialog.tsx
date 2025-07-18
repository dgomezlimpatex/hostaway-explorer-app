import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useInventoryStock } from '@/hooks/useInventory';
import { useMovements } from '@/hooks/useMovements';
import { InventoryMovementType } from '@/types/inventory';

const formSchema = z.object({
  product_id: z.string().min(1, 'Selecciona un producto'),
  movement_type: z.enum(['entrada', 'salida', 'ajuste'] as const),
  quantity: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  reason: z.string().min(1, 'Proporciona un motivo'),
});

type FormData = z.infer<typeof formSchema>;

interface CreateMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMovementCreated: () => void;
}

export function CreateMovementDialog({
  open,
  onOpenChange,
  onMovementCreated
}: CreateMovementDialogProps) {
  const { data: stockWithProducts } = useInventoryStock();
  const { createMovement, isCreatingMovement } = useMovements();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_id: '',
      movement_type: 'entrada',
      quantity: 1,
      reason: '',
    },
  });

  const selectedProductId = form.watch('product_id');
  const movementType = form.watch('movement_type');
  const quantity = form.watch('quantity');

  const selectedStock = stockWithProducts?.find(s => s.product_id === selectedProductId);
  const currentQuantity = selectedStock?.current_quantity || 0;

  const calculateNewQuantity = () => {
    switch (movementType) {
      case 'entrada':
        return currentQuantity + quantity;
      case 'salida':
        return Math.max(0, currentQuantity - quantity);
      case 'ajuste':
        return quantity;
      default:
        return currentQuantity;
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!selectedStock) return;

    const previous_quantity = selectedStock.current_quantity;
    let new_quantity: number;

    switch (data.movement_type) {
      case 'entrada':
        new_quantity = previous_quantity + data.quantity;
        break;
      case 'salida':
        new_quantity = Math.max(0, previous_quantity - data.quantity);
        break;
      case 'ajuste':
        new_quantity = data.quantity;
        break;
      default:
        new_quantity = previous_quantity;
    }

    try {
      await createMovement({
        product_id: data.product_id,
        movement_type: data.movement_type as InventoryMovementType,
        quantity: data.movement_type === 'ajuste' ? Math.abs(new_quantity - previous_quantity) : data.quantity,
        reason: data.reason,
        previous_quantity,
        new_quantity,
      });

      form.reset();
      onMovementCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating movement:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nuevo Movimiento de Inventario</DialogTitle>
          <DialogDescription>
            Registra una entrada, salida o ajuste de inventario.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Producto</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un producto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stockWithProducts?.map((stock) => (
                        <SelectItem key={stock.product_id} value={stock.product_id}>
                          {stock.product.name} - Stock: {stock.current_quantity} {stock.product.unit_of_measure}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="movement_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimiento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada - Agregar stock</SelectItem>
                      <SelectItem value="salida">Salida - Retirar stock</SelectItem>
                      <SelectItem value="ajuste">Ajuste - Establecer cantidad exacta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {movementType === 'ajuste' ? 'Nueva Cantidad Total' : 'Cantidad'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="0.1"
                      placeholder="Ej: 5"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedStock && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Stock Actual</p>
                  <p className="text-lg font-bold">
                    {currentQuantity} {selectedStock.product.unit_of_measure}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Stock Resultante</p>
                  <p className="text-lg font-bold text-primary">
                    {calculateNewQuantity()} {selectedStock.product.unit_of_measure}
                  </p>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe el motivo del movimiento..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreatingMovement}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreatingMovement}>
                {isCreatingMovement ? 'Registrando...' : 'Registrar Movimiento'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}