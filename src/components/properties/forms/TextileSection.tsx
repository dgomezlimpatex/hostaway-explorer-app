
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Control } from 'react-hook-form';
import { PropertyFormData } from './PropertyFormSchema';

interface TextileSectionProps {
  control: Control<PropertyFormData>;
}

export const TextileSection = ({ control }: TextileSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
        🧺 Apartado Téxtil
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="numeroSabanas"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🛏️ Número de Sábanas
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
          name="numeroFundasAlmohada"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                💤 Fundas de Almohada
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
          name="numeroSabanasRequenas"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🛏️ Sábanas Pequeñas
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
          name="numeroSabanasSuite"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🏨 Sábanas Suite
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
          name="numeroToallasGrandes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🏖️ Toallas Grandes
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
          name="numeroTotallasPequenas"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🤏 Toallas Pequeñas
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
          name="numeroAlfombrines"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🪄 Alfombrines de Baño
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
          name="kitAlimentario"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🍽️ Kit Alimentario
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
          name="cantidadRollosPapelHigienico"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🧻 Rollos de Papel Higiénico
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
          name="cantidadRollosPapelCocina"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                🍽️ Rollos de Papel de Cocina
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
