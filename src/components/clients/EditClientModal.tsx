
import { useEffect, useRef, useState } from 'react';
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
import { useClients, useUpdateClient } from '@/hooks/useClients';
import { toast } from '@/hooks/use-toast';
import { Client } from '@/types/client';
import { AlertTriangle, Edit } from 'lucide-react';
import { ClientFormFields } from './ClientFormFields';
import { buildClientSchema, buildClientUpdate, clientToFormValues, type ClientFormValues } from './clientRules';

interface EditClientModalProps {
  client: Client;
  trigger: React.ReactNode;
  canEditFiscal: boolean;
  inheritingProperties?: number;
  ownStateProperties?: number;
}

const sameValues = (a: ClientFormValues, b: ClientFormValues) => JSON.stringify(a) === JSON.stringify(b);

export const EditClientModal = ({ client, trigger, canEditFiscal, inheritingProperties, ownStateProperties }: EditClientModalProps) => {
  const [open, setOpen] = useState(false);
  const updateClient = useUpdateClient();
  const { data: clients = [] } = useClients();
  // Valores de referencia: los que había al abrir (o al cargar los datos actuales).
  const [baseline, setBaseline] = useState(() => clientToFormValues(client));
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const [conflict, setConflict] = useState(false);

  const form = useForm<ClientFormValues>({
    resolver: (values, context, options) => zodResolver(buildClientSchema('edit', baselineRef.current))(values, context, options),
    defaultValues: baseline,
  });

  const loadCurrent = () => {
    const current = clientToFormValues(client);
    setBaseline(current);
    form.reset(current);
    setConflict(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) loadCurrent();
    setOpen(next);
  };

  // Si los datos del cliente se refrescan con el diálogo abierto, no se cierra ni se pierde lo escrito.
  const incoming = clientToFormValues(client);
  const incomingKey = JSON.stringify(incoming);
  useEffect(() => {
    if (!open || sameValues(incoming, baselineRef.current)) return;
    const edited = Object.keys(buildClientUpdate(form.getValues(), baselineRef.current, { canEditFiscal: true })).length > 0;
    if (edited) setConflict(true);
    else loadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingKey, open]);

  const onSubmit = (data: ClientFormValues) => {
    const updates = buildClientUpdate(data, baseline, { canEditFiscal });
    if (!Object.keys(updates).length) {
      toast({ title: 'Sin cambios', description: 'No has modificado ningún dato.' });
      setOpen(false);
      return;
    }
    updateClient.mutate({ id: client.id, updates }, {
      onSuccess: () => {
        setOpen(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto overflow-x-hidden rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex min-w-0 items-center gap-2 break-words text-xl font-black text-slate-950">
            <Edit className="h-5 w-5 shrink-0 text-[#310984]" />
            Editar {client.nombre}
          </DialogTitle>
          <DialogDescription>Solo se guardan los datos que cambies. El acceso al portal se gestiona en la pestaña «Portal» de la ficha.</DialogDescription>
        </DialogHeader>

        {conflict && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 shrink-0" />Este cliente ha cambiado mientras lo editabas</p>
            <p className="mt-1 text-xs">Se conserva lo que has escrito. Al guardar solo se envían los campos que has cambiado; revisa que no sustituyan datos nuevos.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-lg bg-white" onClick={loadCurrent}>Descartar mis cambios y ver los datos actuales</Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-lg" onClick={() => setConflict(false)}>Seguir editando</Button>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="min-w-0 space-y-5" noValidate>
            <ClientFormFields form={form} mode="edit" initial={baseline} clients={clients} clientId={client.id} canEditFiscal={canEditFiscal}
              inheritingProperties={inheritingProperties} ownStateProperties={ownStateProperties} onOpenClient={() => setOpen(false)} />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl" disabled={updateClient.isPending}>
                {updateClient.isPending ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
