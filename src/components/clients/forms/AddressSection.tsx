
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Control } from 'react-hook-form';
import { ClientFormData } from './ClientFormSchema';

interface AddressSectionProps {
  control: Control<ClientFormData>;
}

export const AddressSection = ({ control }: AddressSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
        🏠 Dirección
      </h3>
      <FormField
        control={control}
        name="direccionFacturacion"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              🏠 Dirección facturación
            </FormLabel>
            <FormControl>
              <Textarea {...field} rows={3} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="codigoPostal"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                📮 Código postal
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="ciudad"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🏙️ Ciudad
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
