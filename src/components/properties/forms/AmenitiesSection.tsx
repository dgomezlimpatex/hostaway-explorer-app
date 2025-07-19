import { Control } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PropertyFormData } from './PropertyFormSchema';
import { Package } from 'lucide-react';

interface AmenitiesSectionProps {
  control: Control<PropertyFormData>;
}

export const AmenitiesSection = ({ control }: AmenitiesSectionProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Amenities</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="amenitiesBano"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amenities de Baño</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={control}
          name="amenitiesCocina"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amenities de Cocina</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};