
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateClient } from '@/hooks/useClients';
import { useSede } from '@/contexts/SedeContext';
import { CreateClientData } from '@/types/client';
import { Plus, AlertTriangle } from 'lucide-react';
import { clientSchema, ClientFormData } from './forms/ClientFormSchema';
import { PersonalInfoSection } from './forms/PersonalInfoSection';
import { ContactInfoSection } from './forms/ContactInfoSection';
import { AddressSection } from './forms/AddressSection';
import { ServiceInfoSection } from './forms/ServiceInfoSection';

export const CreateClientModal = () => {
  const [open, setOpen] = useState(false);
  const { activeSede, isActiveSedeSet } = useSede();
  const createClient = useCreateClient();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nombre: '',
      cifNif: '',
      telefono: '',
      email: '',
      direccionFacturacion: '',
      codigoPostal: '',
      ciudad: '',
      tipoServicio: 'mantenimiento-airbnb',
      metodoPago: 'transferencia',
      supervisor: '',
      factura: false,
      linenControlEnabled: false,
    },
  });

  const onSubmit = (data: CreateClientData) => {
    if (!isActiveSedeSet()) {
      return;
    }

    createClient.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-700 flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Crear Nuevo Cliente
          </DialogTitle>
        </DialogHeader>

        {!isActiveSedeSet() ? (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Debes seleccionar una sede antes de crear un cliente.
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  📍 Creando cliente en: <strong>{activeSede?.nombre}</strong>
                </p>
              </div>

              <PersonalInfoSection control={form.control} />
              <ContactInfoSection control={form.control} />
              <AddressSection control={form.control} />
              <ServiceInfoSection control={form.control} />

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
                  disabled={createClient.isPending || !isActiveSedeSet()}
                >
                  {createClient.isPending ? 'Creando...' : 'Crear Cliente'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
