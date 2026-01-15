
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, ClientFormData } from './forms/ClientFormSchema';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useUpdateClient } from '@/hooks/useClients';
import { CreateClientData, Client } from '@/types/client';
import { Edit } from 'lucide-react';
import { ClientPortalSection } from '@/components/client-portal/ClientPortalSection';

interface EditClientModalProps {
  client: Client;
  trigger: React.ReactNode;
}

export const EditClientModal = ({ client, trigger }: EditClientModalProps) => {
  const [open, setOpen] = useState(false);
  const updateClient = useUpdateClient();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nombre: client.nombre,
      cifNif: client.cifNif,
      telefono: client.telefono,
      email: client.email,
      direccionFacturacion: client.direccionFacturacion,
      codigoPostal: client.codigoPostal,
      ciudad: client.ciudad,
      tipoServicio: client.tipoServicio,
      metodoPago: client.metodoPago,
      supervisor: client.supervisor,
      factura: client.factura,
      linenControlEnabled: client.linenControlEnabled || false,
      isActive: client.isActive !== false,
    },
  });

  const onSubmit = (data: ClientFormData) => {
    updateClient.mutate({ id: client.id, updates: data }, {
      onSuccess: () => {
        setOpen(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>
        {trigger}
      </div>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-700 flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editar Cliente: {client.nombre}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Información Personal */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
                📝 Información Personal
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        👤 Nombre
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cifNif"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        🆔 CIF/NIF
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

            {/* Información de Contacto */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
                📞 Información de Contacto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        📱 Teléfono
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        ✉️ Email
                      </FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
                🏠 Dirección
              </h3>
              <FormField
                control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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

            {/* Información de Servicio */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
                ⚙️ Información de Servicio
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
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
                            <RadioGroupItem value="limpieza-mantenimiento" id="edit-limpieza-mantenimiento" />
                            <Label htmlFor="edit-limpieza-mantenimiento">Limpieza y Mantenimiento</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mantenimiento-cristaleria" id="edit-mantenimiento-cristaleria" />
                            <Label htmlFor="edit-mantenimiento-cristaleria">Mantenimiento Cristalería</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mantenimiento-airbnb" id="edit-mantenimiento-airbnb" />
                            <Label htmlFor="edit-mantenimiento-airbnb">Mantenimiento Airbnb</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="limpieza-puesta-punto" id="edit-limpieza-puesta-punto" />
                            <Label htmlFor="edit-limpieza-puesta-punto">Limpieza Puesta a Punto</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="limpieza-final-obra" id="edit-limpieza-final-obra" />
                            <Label htmlFor="edit-limpieza-final-obra">Limpieza Final de Obra</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="check-in" id="edit-check-in" />
                            <Label htmlFor="edit-check-in">Check-in</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="desplazamiento" id="edit-desplazamiento" />
                            <Label htmlFor="edit-desplazamiento">Desplazamiento</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="limpieza-especial" id="edit-limpieza-especial" />
                            <Label htmlFor="edit-limpieza-especial">Limpieza Especial</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="trabajo-extraordinario" id="edit-trabajo-extraordinario" />
                            <Label htmlFor="edit-trabajo-extraordinario">Trabajo Extraordinario</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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
                            <RadioGroupItem value="transferencia" id="edit-transferencia" />
                            <Label htmlFor="edit-transferencia">Transferencia</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="efectivo" id="edit-efectivo" />
                            <Label htmlFor="edit-efectivo">Efectivo</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="bizum" id="edit-bizum" />
                            <Label htmlFor="edit-bizum">Bizum</Label>
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                          Activar seguimiento de ropa limpia
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value !== false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2">
                          ✅ Cliente Activo
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Si está desactivado, no aparecerá en selectores
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Portal de Reservas */}
            <ClientPortalSection clientId={client.id} clientName={client.nombre} />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateClient.isPending}
              >
                {updateClient.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
