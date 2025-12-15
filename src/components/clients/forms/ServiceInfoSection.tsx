
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
                    <RadioGroupItem value="limpieza-mantenimiento" id="limpieza-mantenimiento" />
                    <Label htmlFor="limpieza-mantenimiento">Limpieza de Mantenimiento</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mantenimiento-cristaleria" id="mantenimiento-cristaleria" />
                    <Label htmlFor="mantenimiento-cristaleria">Mantenimiento de Cristalería</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mantenimiento-airbnb" id="mantenimiento-airbnb" />
                    <Label htmlFor="mantenimiento-airbnb">Mantenimiento Airbnb</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="limpieza-puesta-punto" id="limpieza-puesta-punto" />
                    <Label htmlFor="limpieza-puesta-punto">Limpieza de Puesta a Punto</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="limpieza-final-obra" id="limpieza-final-obra" />
                    <Label htmlFor="limpieza-final-obra">Limpieza Final de Obra</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="check-in" id="check-in" />
                    <Label htmlFor="check-in">Check In</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="desplazamiento" id="desplazamiento" />
                    <Label htmlFor="desplazamiento">Desplazamiento</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="limpieza-especial" id="limpieza-especial" />
                    <Label htmlFor="limpieza-especial">Limpieza Especial</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="trabajo-extraordinario" id="trabajo-extraordinario" />
                    <Label htmlFor="trabajo-extraordinario">Trabajo Extraordinario</Label>
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

        <FormField
          control={control}
          name="linenControlEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="flex items-center gap-2">
                  🛏️ Control de Mudas
                </FormLabel>
                <p className="text-xs text-muted-foreground">
                  Activar seguimiento de ropa limpia para este cliente
                </p>
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};
