
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Control } from 'react-hook-form';
import { ClientFormData } from './ClientFormSchema';

interface ServiceInfoSectionProps {
  control: Control<ClientFormData>;
}

export const ServiceInfoSection = ({ control }: ServiceInfoSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
        ⚙️ Información de Servicio
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="tipoServicio"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🛠️ Tipo servicio
              </FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mantenimiento" id="mantenimiento" />
                    <Label htmlFor="mantenimiento">Mantenimiento</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cristaleria" id="cristaleria" />
                    <Label htmlFor="cristaleria">Cristalería</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="airbnb" id="airbnb" />
                    <Label htmlFor="airbnb">Airbnb</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="otro" id="otro" />
                    <Label htmlFor="otro">Otro</Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="metodoPago"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                💳 Método pago
              </FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="transferencia" id="transferencia" />
                    <Label htmlFor="transferencia">Transferencia</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="efectivo" id="efectivo" />
                    <Label htmlFor="efectivo">Efectivo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bizum" id="bizum" />
                    <Label htmlFor="bizum">Bizum</Label>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="supervisor"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                👥 Supervisor
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
          name="factura"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="flex items-center gap-2">
                  📄 Factura
                </FormLabel>
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
