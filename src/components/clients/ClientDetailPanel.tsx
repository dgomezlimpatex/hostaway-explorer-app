import { useState, type ReactNode } from 'react';
import { Edit, Mail, Phone, Trash2, Contact, Receipt, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CrmDetailFrame } from '@/components/directory/CrmDetailFrame';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useDeleteClient } from '@/hooks/useClients';
import { Client } from '@/types/client';
import { EditClientModal } from './EditClientModal';
import { CLIENT_SERVICE_LABELS, clientInitials } from './clientPresentation';

export function ClientDetailPanel({ client }: { client: Client }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteClient = useDeleteClient();

  return (
    <CrmDetailFrame title={client.nombre} subtitle={`CIF/NIF · ${client.cifNif || 'Sin indicar'}`} avatar={clientInitials(client.nombre)} status={client.isActive !== false ? 'Activo' : 'Inactivo'} metricLabel="Facturación" metricValue={client.factura ? 'Con factura' : 'Sin factura'}
      actions={<>
          <EditClientModal key={JSON.stringify(client)} client={client} trigger={<Button className="rounded-xl"><Edit className="mr-2 h-4 w-4" />Editar cliente</Button>} />
          {client.telefono && <Button asChild variant="outline" className="rounded-xl bg-white"><a href={`tel:${client.telefono}`}><Phone className="mr-2 h-4 w-4" />Llamar</a></Button>}
          {client.email && <Button asChild variant="outline" className="rounded-xl bg-white"><a href={`mailto:${client.email}`}><Mail className="mr-2 h-4 w-4" />Enviar email</a></Button>}
        </>}
      footer={<><div className="flex justify-end">
          <Button variant="ghost" className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Eliminar cliente</Button>
        </div></>}
      tabs={[
        { id: 'profile', label: 'Ficha', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Contact className="h-4 w-4 text-[#310984]" />Contacto</h3>
          <dl className="grid gap-4  sm:grid-cols-2">
            <Field label="Teléfono">{client.telefono || 'Sin indicar'}</Field>
            <Field label="Email">{client.email || 'Sin indicar'}</Field>
            <Field label="Supervisor">{client.supervisor || 'Sin asignar'}</Field>
            <Field label="Ciudad">{client.ciudad || 'Sin indicar'}</Field>
          </dl>
        </section></> },
        { id: 'billing', label: 'Facturación', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Receipt className="h-4 w-4 text-[#310984]" />Facturación</h3>
          <dl className="grid gap-4  sm:grid-cols-2">
            <Field label="Dirección de facturación">{client.direccionFacturacion || 'Sin indicar'}</Field>
            <Field label="Código postal y ciudad">{[client.codigoPostal, client.ciudad].filter(Boolean).join(' · ') || 'Sin indicar'}</Field>
            <Field label="Método de pago">{{ transferencia: 'Transferencia', efectivo: 'Efectivo', bizum: 'Bizum' }[client.metodoPago] || 'Sin indicar'}</Field>
            <Field label="Emisión de factura">{client.factura ? 'Con factura' : 'Sin factura'}</Field>
          </dl>
        </section></> },
        { id: 'service', label: 'Servicio', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Settings2 className="h-4 w-4 text-[#310984]" />Servicio y preferencias</h3>
          <dl className="grid gap-4  sm:grid-cols-2">
            <Field label="Tipo de servicio">{CLIENT_SERVICE_LABELS[client.tipoServicio] || client.tipoServicio}</Field>
            <Field label="Control de lencería">{client.linenControlEnabled ? 'Activado' : 'Desactivado'}</Field>
            <Field label="Fotos visibles para el cliente">{client.photosVisibleToClient ? 'Sí' : 'No'}</Field>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Gestiona los datos, el estado y el acceso al portal desde «Editar cliente».</p>
        </section></> },
      ]}
    >
      <AlertDialog open={confirmDelete} onOpenChange={open => !deleteClient.isPending && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {client.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción elimina el cliente. Si solo quieres dejar de trabajar con él, puedes marcarlo como inactivo desde «Editar cliente».</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClient.isPending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteClient.isPending} onClick={() => deleteClient.mutate(client.id, { onSuccess: () => setConfirmDelete(false) })}>{deleteClient.isPending ? 'Eliminando…' : 'Eliminar cliente'}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CrmDetailFrame>
  );}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-line break-words text-sm font-semibold text-slate-900">{children}</dd></div>;
}
