import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCreateWorkerHourAdjustment } from '@/hooks/useWorkerHourAdjustments';
import { useCleaners } from '@/hooks/useCleaners';
import { ADJUSTMENT_CATEGORIES, AdjustmentCategory } from '@/types/workload';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';

const adjustmentSchema = z.object({
  cleanerId: z.string().min(1, 'Selecciona un trabajador'),
  date: z.date({ required_error: 'Selecciona una fecha' }),
  adjustmentType: z.enum(['add', 'subtract']),
  hours: z.number().min(0.25, 'Mínimo 0.25 horas').max(24, 'Máximo 24 horas'),
  category: z.enum(['extra', 'training', 'absence', 'correction', 'other']),
  reason: z.string().min(3, 'El motivo es requerido'),
  notes: z.string().optional(),
});

type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

interface HourAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCleanerId?: string;
  preselectedDate?: Date;
}

export const HourAdjustmentModal = ({ 
  open, 
  onOpenChange, 
  preselectedCleanerId,
  preselectedDate 
}: HourAdjustmentModalProps) => {
  const { cleaners } = useCleaners();
  const createAdjustment = useCreateWorkerHourAdjustment();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      cleanerId: preselectedCleanerId || '',
      date: preselectedDate || new Date(),
      adjustmentType: 'add',
      hours: 1,
      category: 'other',
      reason: '',
      notes: '',
    },
  });

  // Reset form when modal opens with new preselected values
  React.useEffect(() => {
    if (open) {
      reset({
        cleanerId: preselectedCleanerId || '',
        date: preselectedDate || new Date(),
        adjustmentType: 'add',
        hours: 1,
        category: 'other',
        reason: '',
        notes: '',
      });
    }
  }, [open, preselectedCleanerId, preselectedDate, reset]);

  const onSubmit = async (data: AdjustmentFormData) => {
    const hours = data.adjustmentType === 'subtract' ? -data.hours : data.hours;
    
    await createAdjustment.mutateAsync({
      cleanerId: data.cleanerId,
      date: format(data.date, 'yyyy-MM-dd'),
      hours,
      category: data.category as AdjustmentCategory,
      reason: data.reason,
      notes: data.notes,
    });

    onOpenChange(false);
    reset();
  };

  const selectedCleaner = cleaners.find(c => c.id === watch('cleanerId'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Añadir Ajuste de Horas</DialogTitle>
          <DialogDescription>
            Añade o resta horas manualmente al registro de un trabajador
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Worker selector */}
          <div className="space-y-2">
            <Label htmlFor="cleanerId">Trabajador</Label>
            <Controller
              name="cleanerId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un trabajador" />
                  </SelectTrigger>
                  <SelectContent>
                    {cleaners.filter(c => c.isActive).map(cleaner => (
                      <SelectItem key={cleaner.id} value={cleaner.id}>
                        {cleaner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.cleanerId && (
              <p className="text-sm text-destructive">{errors.cleanerId.message}</p>
            )}
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (
                        format(field.value, "PPP", { locale: es })
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      locale={es}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.date && (
              <p className="text-sm text-destructive">{errors.date.message}</p>
            )}
          </div>

          {/* Adjustment type */}
          <div className="space-y-2">
            <Label>Tipo de ajuste</Label>
            <Controller
              name="adjustmentType"
              control={control}
              render={({ field }) => (
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="add" id="add" />
                    <Label htmlFor="add" className="font-normal cursor-pointer">
                      Añadir horas
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="subtract" id="subtract" />
                    <Label htmlFor="subtract" className="font-normal cursor-pointer">
                      Restar horas
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
          </div>

          {/* Hours input */}
          <div className="space-y-2">
            <Label htmlFor="hours">Horas</Label>
            <Controller
              name="hours"
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  {...field}
                  onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                />
              )}
            />
            {errors.hours && (
              <p className="text-sm text-destructive">{errors.hours.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Input
              id="reason"
              {...register('reason')}
              placeholder="Ej: Formación nuevo producto"
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Ajuste'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
