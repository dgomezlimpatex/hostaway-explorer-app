
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Control } from 'react-hook-form';
import { PropertyFormData } from './PropertyFormSchema';
import { useClients } from '@/hooks/useClients';

interface ClientSelectionSectionProps {
  control: Control<PropertyFormData>;
}

export const ClientSelectionSection = ({ control }: ClientSelectionSectionProps) => {
  const { data: clients } = useClients();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
        👥 Cliente Asociado
      </h3>
      <FormField
        control={control}
        name="clienteId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              🏢 Seleccionar Cliente
            </FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.nombre} - {client.cifNif}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
