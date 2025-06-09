
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Control } from 'react-hook-form';
import { PropertyFormData } from './PropertyFormSchema';

interface ServiceSectionProps {
  control: Control<PropertyFormData>;
}

export const ServiceSection = ({ control }: ServiceSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
        ⚙️ Información del Servicio
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="duracionServicio"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                ⏱️ Duración del Servicio (minutos)
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="number" 
                  min="15"
                  placeholder="120"
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="costeServicio"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                💰 Coste del Servicio (€)
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  type="number" 
                  min="0"
                  step="0.01"
                  placeholder="45.00"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
