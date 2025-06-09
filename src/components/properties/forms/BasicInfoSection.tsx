
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Control } from 'react-hook-form';
import { PropertyFormData } from './PropertyFormSchema';

interface BasicInfoSectionProps {
  control: Control<PropertyFormData>;
}

export const BasicInfoSection = ({ control }: BasicInfoSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
        🏠 Información Básica
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="codigo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🏷️ Código
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder="P001" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                📍 Nombre del Piso
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder="Apartamento Centro" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="direccion"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              🗺️ Dirección
            </FormLabel>
            <FormControl>
              <Input {...field} placeholder="Calle Mayor 123, 28001 Madrid" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
