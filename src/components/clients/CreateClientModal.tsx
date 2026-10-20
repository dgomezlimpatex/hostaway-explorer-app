
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useClients, useCreateClient } from '@/hooks/useClients';
import { useSede } from '@/contexts/SedeContext';
import { Plus, AlertTriangle, MapPin } from 'lucide-react';
import { ClientFormFields } from './ClientFormFields';
import { buildClientSchema, clientToFormValues, formValuesToCreateData, type ClientFormValues } from './clientRules';

export const CreateClientModal = () => {
  const [open, setOpen] = useState(false);
  const { activeSede, isActiveSedeSet } = useSede();
  const createClient = useCreateClient();
  const { data: clients = [] } = useClients();
  const initial = useMemo(() => clientToFormValues(null), []);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(buildClientSchema('create')),
    defaultValues: initial,
  });

  const onSubmit = (data: ClientFormValues) => {
    if (!isActiveSedeSet()) {
      return;
    }

    createClient.mutate(formValuesToCreateData(data), {
      onSuccess: () => {
        setOpen(false);
        form.reset(initial);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 rounded-xl">
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto overflow-x-hidden rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Plus className="h-5 w-5 text-[#310984]" />
            Nuevo cliente
          </DialogTitle>
          <DialogDescription>Todos los datos son obligatorios al crear un cliente.</DialogDescription>
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-0 space-y-5" noValidate>
              <p className="flex items-center gap-2 rounded-xl bg-violet-50 p-3 text-sm text-violet-950">
                <MapPin className="h-4 w-4 shrink-0 text-[#310984]" />
                Se creará en la sede <strong>{activeSede?.nombre}</strong>
              </p>

              <ClientFormFields form={form} mode="create" initial={initial} clients={clients} canEditFiscal onOpenClient={() => setOpen(false)} />

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-xl" disabled={createClient.isPending || !isActiveSedeSet()}>
                  {createClient.isPending ? 'Creando…' : 'Crear cliente'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
