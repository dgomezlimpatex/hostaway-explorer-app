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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Package, TrendingDown, TrendingUp, RotateCcw } from 'lucide-react';
import { useStockAdjustment } from '@/hooks/useInventory';
import { useAuth } from '@/hooks/useAuth';
import { StockValidationDialog } from './StockValidationDialog';
import type { InventoryStockWithProduct, StockAdjustmentForm } from '@/types/inventory';

const adjustmentSchema = z.object({
  product_id: z.string(),
  adjustment_type: z.enum(['entrada', 'salida', 'ajuste'], {
    required_error: 'Debe seleccionar un tipo de ajuste',
  }),
  quantity: z.number().min(0, 'La cantidad debe ser mayor o igual a 0'),
  reason: z.string().min(1, 'La razón es requerida'),
  cost_per_unit: z.number().min(0, 'El costo debe ser mayor o igual a 0').optional(),
});

type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockItem: InventoryStockWithProduct | null;
}

export const StockAdjustmentDialog = ({ 
  open, 
  onOpenChange,
  stockItem
}: StockAdjustmentDialogProps) => {
  const { user } = useAuth();
  const stockAdjustment = useStockAdjustment();
  const [showValidation, setShowValidation] = useState(false);
  const [pendingAdjustment, setPendingAdjustment] = useState<AdjustmentFormData | null>(null);

  const form = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      product_id: stockItem?.product_id || '',
      adjustment_type: 'entrada',
      quantity: 1,
      reason: '',
      cost_per_unit: stockItem?.cost_per_unit || undefined,
    },
  });

  const adjustmentType = form.watch('adjustment_type');
  const quantity = form.watch('quantity');

  // Calculate new quantity based on adjustment type
  const getNewQuantity = (adjustmentData?: AdjustmentFormData) => {
    if (!stockItem) return 0;
    const qty = adjustmentData?.quantity || quantity;
    const type = adjustmentData?.adjustment_type || adjustmentType;
    
    switch (type) {
      case 'entrada':
        return stockItem.current_quantity + qty;
      case 'salida':
        return Math.max(0, stockItem.current_quantity - qty);
      case 'ajuste':
        return qty;
      default:
        return stockItem.current_quantity;
    }
  };

  const handleSubmit = async (data: AdjustmentFormData) => {
    if (!user?.id || !stockItem) return;

    const newQuantity = getNewQuantity(data);
    const isLargeAdjustment = Math.abs(data.quantity) > 50;
    const isNegativeStock = newQuantity < 0;

    // Verificar si necesita validación adicional
    if (isLargeAdjustment || isNegativeStock) {
      setPendingAdjustment(data);
      setShowValidation(true);
      return;
    }

    // Proceder directamente si no necesita validación
    await executeAdjustment(data);
  };

  const executeAdjustment = async (data: AdjustmentFormData) => {
    if (!user?.id || !stockItem) return;

    try {
      await stockAdjustment.mutateAsync({
        adjustment: {
          product_id: data.product_id!,
          adjustment_type: data.adjustment_type!,
          quantity: data.quantity!,
          reason: data.reason!,
          cost_per_unit: data.cost_per_unit,
        },
        userId: user.id,
        currentStock: stockItem,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  const handleValidationConfirm = async () => {
    if (pendingAdjustment) {
      await executeAdjustment(pendingAdjustment);
      setPendingAdjustment(null);
      setShowValidation(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setPendingAdjustment(null);
    setShowValidation(false);
    onOpenChange(false);
  };

  if (!stockItem) return null;

  const newQuantity = getNewQuantity();
  const isLoading = stockAdjustment.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ajustar Stock
          </DialogTitle>
        </DialogHeader>

        {/* Product info */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{stockItem.product.name}</h3>
              <Badge variant="outline">
                {stockItem.product.category?.name || 'Sin categoría'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Stock actual</div>
                <div className="font-mono font-medium">
                  {stockItem.current_quantity} {stockItem.product.unit_of_measure}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Mínimo
                </div>
                <div className="font-mono">{stockItem.minimum_stock}</div>
              </div>
              <div>
                <div className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Máximo
                </div>
                <div className="font-mono">{stockItem.maximum_stock}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="adjustment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de ajuste</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            Entrada (agregar stock)
                          </div>
                        </SelectItem>
                        <SelectItem value="salida">
                          <div className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-600" />
                            Salida (quitar stock)
                          </div>
                        </SelectItem>
                        <SelectItem value="ajuste">
                          <div className="flex items-center gap-2">
                            <RotateCcw className="h-4 w-4 text-blue-600" />
                            Ajuste (establecer cantidad exacta)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
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
                    {adjustmentType === 'ajuste' ? 'Nueva cantidad' : 'Cantidad'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New quantity preview */}
            {quantity > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stock actual:</span>
                      <span className="font-mono">{stockItem.current_quantity}</span>
                    </div>
                    {adjustmentType !== 'ajuste' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {adjustmentType === 'entrada' ? 'Cantidad a añadir:' : 'Cantidad a quitar:'}
                        </span>
                        <span className="font-mono">
                          {adjustmentType === 'entrada' ? '+' : '-'}{quantity}
                        </span>
                      </div>
                    )}
                    <hr className="my-1" />
                    <div className="flex justify-between font-medium">
                      <span>Nuevo stock:</span>
                      <span className={`font-mono ${
                        newQuantity <= stockItem.minimum_stock ? 'text-destructive' : 
                        newQuantity >= stockItem.maximum_stock ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {newQuantity} {stockItem.product.unit_of_measure}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo del ajuste</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describir el motivo del ajuste..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cost_per_unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Costo por unidad (€) - opcional</FormLabel>
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
                Confirmar Ajuste
              </Button>
            </div>
          </form>
        </Form>

        {/* Validation Dialog */}
        {pendingAdjustment && (
          <StockValidationDialog
            open={showValidation}
            onOpenChange={setShowValidation}
            onConfirm={handleValidationConfirm}
            adjustmentData={{
              productName: stockItem.product.name,
              currentQuantity: stockItem.current_quantity,
              adjustmentQuantity: pendingAdjustment.adjustment_type === 'salida' 
                ? -pendingAdjustment.quantity 
                : pendingAdjustment.quantity,
              newQuantity: getNewQuantity(pendingAdjustment),
              adjustmentType: pendingAdjustment.adjustment_type
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};