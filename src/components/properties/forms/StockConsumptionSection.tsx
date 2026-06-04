import { useEffect, useMemo, useRef } from 'react';
import { Control, UseFormSetValue } from 'react-hook-form';
import { Package, Shirt } from 'lucide-react';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePropertyStockConsumptionRules, useStockProducts } from '@/hooks/useStock';
import type { Property } from '@/types/property';
import type { StockProduct } from '@/types/stock';
import { PropertyFormData } from './PropertyFormSchema';
import { buildInitialStockConsumptions, normalizeStockName } from './propertyStockConsumption';

interface StockConsumptionSectionProps {
  control: Control<PropertyFormData>;
  setValue: UseFormSetValue<PropertyFormData>;
  property?: Property | null;
}

type ProductGroupKey = 'laundry' | 'amenities' | 'consumables' | 'other';

const groupLabels: Record<ProductGroupKey, string> = {
  laundry: 'Lavandería',
  amenities: 'Amenities',
  consumables: 'Consumibles',
  other: 'Otros',
};

const getProductGroup = (product: StockProduct): ProductGroupKey => {
  if (product.category?.kind === 'laundry') return 'laundry';

  const categoryName = normalizeStockName(product.category?.name || '');
  if (categoryName.includes('consumible')) return 'consumables';
  if (product.category?.kind === 'amenity') return 'amenities';

  return 'other';
};

export const StockConsumptionSection = ({ control, setValue, property }: StockConsumptionSectionProps) => {
  const { data: products = [], isLoading: isLoadingProducts } = useStockProducts();
  const { data: rules = [], isLoading: isLoadingRules } = usePropertyStockConsumptionRules(property?.id);
  const initializedKeyRef = useRef<string | null>(null);

  const consumableProducts = useMemo(
    () => products.filter((product) => product.is_consumable),
    [products]
  );

  const groupedProducts = useMemo(() => {
    return consumableProducts.reduce<Record<ProductGroupKey, StockProduct[]>>(
      (groups, product) => {
        groups[getProductGroup(product)].push(product);
        return groups;
      },
      { laundry: [], amenities: [], consumables: [], other: [] }
    );
  }, [consumableProducts]);

  useEffect(() => {
    if (isLoadingProducts || isLoadingRules) return;

    const key = `${property?.id || 'new'}:${consumableProducts.map((product) => product.id).join(',')}:${rules.length}`;
    if (initializedKeyRef.current === key) return;

    setValue('stockConsumptions', buildInitialStockConsumptions(consumableProducts, rules, property), {
      shouldDirty: false,
      shouldTouch: false,
    });
    initializedKeyRef.current = key;
  }, [consumableProducts, isLoadingProducts, isLoadingRules, property, rules, setValue]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Consumo por limpieza</h3>
      </div>

      {isLoadingProducts || isLoadingRules ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : consumableProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay productos consumibles activos en el inventario de esta sede.
        </p>
      ) : (
        (Object.keys(groupedProducts) as ProductGroupKey[]).map((groupKey) => {
          const groupProducts = groupedProducts[groupKey];
          if (groupProducts.length === 0) return null;

          return (
            <div key={groupKey} className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                {groupKey === 'laundry' ? <Shirt className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                {groupLabels[groupKey]}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupProducts.map((product) => (
                  <FormField
                    key={product.id}
                    control={control}
                    name={`stockConsumptions.${product.id}` as const}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {product.name}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({product.unit_of_measure})
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={field.value ?? 0}
                            onChange={(event) => field.onChange(parseInt(event.target.value, 10) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
