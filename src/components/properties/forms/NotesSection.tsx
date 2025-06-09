
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Control } from 'react-hook-form';
import { PropertyFormData } from './PropertyFormSchema';

interface NotesSectionProps {
  control: Control<PropertyFormData>;
}

export const NotesSection = ({ control }: NotesSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
        📝 Notas
      </h3>
      <FormField
        control={control}
        name="notas"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              💭 Observaciones adicionales
            </FormLabel>
            <FormControl>
              <Textarea 
                {...field} 
                placeholder="Añade cualquier observación o nota importante sobre esta propiedad..."
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
