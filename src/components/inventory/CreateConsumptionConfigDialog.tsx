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
import { useInventoryProducts } from '@/hooks/useInventory';
import { useConsumptionConfig } from '@/hooks/useConsumptionConfig';
import { CreatePropertyConsumptionConfigData } from '@/types/inventory';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const formSchema = z.object({
  property_id: z.string().min(1, 'Selecciona una propiedad'),
  product_id: z.string().min(1, 'Selecciona un producto'),
  quantity_per_cleaning: z.number().min(1, 'La cantidad debe ser mayor a 0'),
});

type FormData = z.infer<typeof formSchema>;

interface CreateConsumptionConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigCreated: () => void;
}

export function CreateConsumptionConfigDialog({
  open,
  onOpenChange,
  onConfigCreated
}: CreateConsumptionConfigDialogProps) {
  const { data: products } = useInventoryProducts();
  const { createConfig, isCreating } = useConsumptionConfig();

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, nombre, codigo')
        .order('nombre');
      
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      property_id: '',
      product_id: '',
      quantity_per_cleaning: 1,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await createConfig({
        property_id: data.property_id,
        product_id: data.product_id,
        quantity_per_cleaning: data.quantity_per_cleaning
      });
      form.reset();
      onConfigCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating consumption config:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Configuración de Consumo</DialogTitle>
          <DialogDescription>
            Define cuánto producto se consume por limpieza en una propiedad específica.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="property_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Propiedad</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una propiedad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties?.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.nombre} ({property.codigo})
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
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.unit_of_measure})
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
              name="quantity_per_cleaning"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad por Limpieza</FormLabel>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creando...' : 'Crear Configuración'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}