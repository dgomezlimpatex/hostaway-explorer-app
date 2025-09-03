import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formSchema = z.object({
  type: z.enum(['full-time', 'part-time', 'temporary', 'freelance'], {
    required_error: 'El tipo de contrato es requerido',
  }),
  startDate: z.date({
    required_error: 'La fecha de inicio es requerida',
  }),
  endDate: z.date().optional(),
  position: z.string().min(1, 'La posición es requerida'),
  department: z.string().min(1, 'El departamento es requerido'),
  hourlyRate: z.number().min(0, 'La tarifa debe ser mayor a 0'),
  contractHoursPerWeek: z.number().min(1, 'Las horas semanales son requeridas'),
  benefits: z.array(z.string()).optional(),
  notes: z.string().optional(),
  renewalDate: z.date().optional(),
}).refine((data) => !data.endDate || data.endDate >= data.startDate, {
  message: 'La fecha de fin debe ser posterior a la fecha de inicio',
  path: ['endDate'],
});

type FormData = z.infer<typeof formSchema>;

interface ContractFormProps {
  cleanerId: string;
  contract?: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const benefitOptions = [
  'Seguro médico',
  'Seguro dental',
  'Vacaciones pagadas',
  'Días de enfermedad',
  'Bonificación anual',
  'Plan de pensiones',
  'Formación profesional',
  'Transporte',
  'Comida',
  'Flexibilidad horaria'
];

export const ContractForm: React.FC<ContractFormProps> = ({
  cleanerId,
  contract,
  open,
  onOpenChange,
}) => {
  const isEditing = !!contract;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: contract?.type || 'full-time',
      startDate: contract ? new Date(contract.startDate) : undefined,
      endDate: contract && contract.endDate ? new Date(contract.endDate) : undefined,
      position: contract?.position || '',
      department: contract?.department || '',
      hourlyRate: contract?.hourlyRate || 0,
      contractHoursPerWeek: contract?.contractHoursPerWeek || 40,
      benefits: contract?.benefits || [],
      notes: contract?.notes || '',
      renewalDate: contract && contract.renewalDate ? new Date(contract.renewalDate) : undefined,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const contractData = {
        cleanerId,
        ...data,
        startDate: data.startDate.toISOString().split('T')[0],
        endDate: data.endDate?.toISOString().split('T')[0],
        renewalDate: data.renewalDate?.toISOString().split('T')[0],
        status: 'draft' as const,
        createdAt: new Date().toISOString(),
      };

      console.log('Contract data:', contractData);

      // TODO: Implement actual contract creation/update
      // if (isEditing && contract) {
      //   await updateContract.mutateAsync({
      //     id: contract.id,
      //     updates: contractData,
      //   });
      // } else {
      //   await createContract.mutateAsync(contractData);
      // }

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting contract:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Contrato' : 'Nuevo Contrato'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Modifica los detalles del contrato existente'
              : 'Completa la información para crear un nuevo contrato'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Contract Type and Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Información Básica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Contrato</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona el tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="full-time">Tiempo Completo</SelectItem>
                            <SelectItem value="part-time">Tiempo Parcial</SelectItem>
                            <SelectItem value="temporary">Temporal</SelectItem>
                            <SelectItem value="freelance">Freelance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posición</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Limpiador Senior" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Limpieza Residencial" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fechas del Contrato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Inicio</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP', { locale: es })
                                ) : (
                                  <span>Selecciona fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Fin (Opcional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP', { locale: es })
                                ) : (
                                  <span>Contrato indefinido</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Deja vacío para contrato indefinido
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="renewalDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Renovación (Opcional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP', { locale: es })
                              ) : (
                                <span>Sin renovación programada</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Fecha para revisar o renovar el contrato
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Compensation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Compensación y Horarios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarifa por Hora (€)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="12.50"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contractHoursPerWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horas Semanales</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="40"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Beneficios</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="benefits"
                  render={() => (
                    <FormItem>
                      <div className="grid grid-cols-2 gap-4">
                        {benefitOptions.map((benefit) => (
                          <FormField
                            key={benefit}
                            control={form.control}
                            name="benefits"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={benefit}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(benefit)}
                                      onCheckedChange={(checked) => {
                                        const updatedBenefits = checked
                                          ? [...(field.value || []), benefit]
                                          : field.value?.filter((value) => value !== benefit) || [];
                                        field.onChange(updatedBenefits);
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {benefit}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas Adicionales</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas del Contrato</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Información adicional sobre el contrato..."
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Información adicional relevante para el contrato
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {isEditing ? 'Actualizar Contrato' : 'Crear Contrato'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};