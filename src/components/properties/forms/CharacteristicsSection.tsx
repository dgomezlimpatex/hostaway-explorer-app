
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Control } from 'react-hook-form';
import { PropertyFormData } from './PropertyFormSchema';

interface CharacteristicsSectionProps {
  control: Control<PropertyFormData>;
}

export const CharacteristicsSection = ({ control }: CharacteristicsSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
        🛏️ Características
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="numeroCamas"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🛏️ Número de Camas
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="number" 
                  min="0"
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="numeroCamasPequenas"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🛏️ Número de Camas Pequeñas
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="number" 
                  min="0"
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="numeroCamasSuite"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🏨 Número de Camas Suite
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="number" 
                  min="0"
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="numeroSofasCama"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🛋️ Número de Sofás Cama
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="number" 
                  min="0"
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="numeroBanos"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🚿 Número de Baños
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="number" 
                  min="1"
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="numeroCocinas"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Numero de Cocinas
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="number" 
                  min="0"
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
