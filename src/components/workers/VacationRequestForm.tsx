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
import { CalendarIcon } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { VacationRequest } from '@/types/calendar';
import { useCreateVacationRequest, useUpdateVacationRequest } from '@/hooks/useVacationRequests';

const formSchema = z.object({
  startDate: z.date({
    required_error: 'La fecha de inicio es requerida',
  }),
  endDate: z.date({
    required_error: 'La fecha de fin es requerida',
  }),
  requestType: z.enum(['vacation', 'sick', 'personal'], {
    required_error: 'El tipo de solicitud es requerido',
  }),
  reason: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'La fecha de fin debe ser posterior a la fecha de inicio',
  path: ['endDate'],
});

type FormData = z.infer<typeof formSchema>;

interface VacationRequestFormProps {
  cleanerId: string;
  request?: VacationRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const VacationRequestForm: React.FC<VacationRequestFormProps> = ({
  cleanerId,
  request,
  open,
  onOpenChange,
}) => {
  const createRequest = useCreateVacationRequest();
  const updateRequest = useUpdateVacationRequest();
  
  const isEditing = !!request;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: request ? new Date(request.startDate) : undefined,
      endDate: request ? new Date(request.endDate) : undefined,
      requestType: request?.requestType || 'vacation',
      reason: request?.reason || '',
      notes: request?.notes || '',
    },
  });

  const watchedStartDate = form.watch('startDate');
  const watchedEndDate = form.watch('endDate');

  // Calculate days requested
  const daysRequested = watchedStartDate && watchedEndDate 
    ? differenceInDays(watchedEndDate, watchedStartDate) + 1 
    : 0;

  const onSubmit = async (data: FormData) => {
    try {
      const requestData = {
        cleanerId,
        startDate: data.startDate.toISOString().split('T')[0],
        endDate: data.endDate.toISOString().split('T')[0],
        daysRequested,
        requestType: data.requestType,
        reason: data.reason,
        notes: data.notes,
        status: 'pending' as const,
        requestedAt: new Date().toISOString(),
      };

      if (isEditing && request) {
        await updateRequest.mutateAsync({
          id: request.id,
          updates: requestData,
        });
      } else {
        await createRequest.mutateAsync(requestData);
      }

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting vacation request:', error);
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'Vacaciones';
      case 'sick':
        return 'Baja Médica';
      case 'personal':
        return 'Asunto Personal';
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Solicitud' : 'Nueva Solicitud de Vacaciones'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Modifica los detalles de tu solicitud existente'
              : 'Completa el formulario para solicitar tiempo libre'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Request Type */}
            <FormField
              control={form.control}
              name="requestType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Solicitud</FormLabel>
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
                      <SelectItem value="vacation">Vacaciones</SelectItem>
                      <SelectItem value="sick">Baja Médica</SelectItem>
                      <SelectItem value="personal">Asunto Personal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Date */}
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
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Date */}
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Fin</FormLabel>
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
                        disabled={(date) => date < new Date() || (watchedStartDate && date < watchedStartDate)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Days calculation */}
            {daysRequested > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Días solicitados:</strong> {daysRequested} días
                </p>
              </div>
            )}

            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Breve descripción del motivo"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Opcional: describe brevemente el motivo de tu solicitud
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas Adicionales</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Información adicional relevante..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Opcional: información adicional que consideres relevante
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createRequest.isPending || updateRequest.isPending}
              >
                {createRequest.isPending || updateRequest.isPending
                  ? 'Procesando...'
                  : isEditing
                  ? 'Actualizar'
                  : 'Crear Solicitud'
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};