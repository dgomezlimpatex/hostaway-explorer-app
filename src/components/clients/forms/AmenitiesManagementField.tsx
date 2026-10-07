import type { Control } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClientFormData } from './ClientFormSchema';

export function AmenitiesManagementField({ control }: { control: Control<ClientFormData> }) {
  return <FormField control={control} name="amenitiesControlEnabled" render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
      <FormControl><Checkbox checked={field.value ?? true} onCheckedChange={field.onChange} /></FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>🧴 Gestión de amenities</FormLabel>
        <p className="text-xs text-muted-foreground">Kits de baño, cocina y alimentación, y paño de cocina. Las propiedades heredan este ajuste salvo configuración personalizada.</p>
      </div>
    </FormItem>
  )} />;
}
