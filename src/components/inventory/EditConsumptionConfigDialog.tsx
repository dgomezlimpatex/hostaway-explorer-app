import { useEffect } from 'react';
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useConsumptionConfig } from '@/hooks/useConsumptionConfig';
import { PropertyConsumptionWithDetails } from '@/types/inventory';

const formSchema = z.object({
  quantity_per_cleaning: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface EditConsumptionConfigDialogProps {
  config: PropertyConsumptionWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigUpdated: (config: PropertyConsumptionWithDetails) => void;
}

export function EditConsumptionConfigDialog({
  config,
  open,
  onOpenChange,
  onConfigUpdated
}: EditConsumptionConfigDialogProps) {
  const { updateConfig, isUpdating } = useConsumptionConfig();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity_per_cleaning: 1,
      is_active: true,
    },
  });

  useEffect(() => {
    if (config) {
      form.setValue('quantity_per_cleaning', config.quantity_per_cleaning);
      form.setValue('is_active', config.is_active);
    }
  }, [config, form]);

  const onSubmit = async (data: FormData) => {
    if (!config) return;

    try {
      await updateConfig({ 
        id: config.id, 
        updates: data 
      });
      onConfigUpdated({ ...config, ...data });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating consumption config:', error);
    }
  };

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Configuración de Consumo</DialogTitle>
          <DialogDescription>
            Modifica la configuración de consumo para {config.product.name} en la propiedad seleccionada.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Producto</p>
                <p className="text-sm text-muted-foreground">{config.product.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Propiedad</p>
                <p className="text-sm text-muted-foreground">
                  {config.property?.nombre || 'Sin nombre'}
                </p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="quantity_per_cleaning"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Cantidad por Limpieza ({config.product.unit_of_measure})
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="0.1"
                      placeholder="Ej: 2"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Estado Activo</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Habilita o deshabilita esta configuración de consumo
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUpdating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Actualizando...' : 'Actualizar Configuración'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}