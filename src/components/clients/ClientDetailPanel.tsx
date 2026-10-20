import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Contact, Edit, Home, Mail, Phone, Power, Receipt, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CrmDetailFrame } from '@/components/directory/CrmDetailFrame';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { ClientPortalSection } from '@/components/client-portal/ClientPortalSection';
import { entityDetailPath } from '@/components/navigation/entityLinks';
import { useClientDeletionCheck, useDeleteClient, useUpdateClient } from '@/hooks/useClients';
import { Client } from '@/types/client';
import { EditClientModal } from './EditClientModal';
import { InactivationNotice } from './ClientFormFields';
import { CLIENT_SERVICE_LABELS, clientInitials } from './clientPresentation';
import { CLIENT_PAYMENT_LABELS, deletionConfirmationMatches, missingBillingData, summarizeClientProperties, type ClientCapabilities, type ClientPropertyLike } from './clientRules';

export type ClientPropertiesState = { properties: readonly ClientPropertyLike[]; status: 'loading' | 'error' | 'ready'; retry?: () => void };

interface ClientDetailPanelProps {
  client: Client;
  capabilities: ClientCapabilities;
  propertiesState: ClientPropertiesState;
}

export function ClientDetailPanel({ client, capabilities, propertiesState }: ClientDetailPanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [typedName, setTypedName] = useState('');
  const deleteClient = useDeleteClient();
  const updateClient = useUpdateClient();
  const deletionCheck = useClientDeletionCheck(client.id, confirmDelete);
  const active = client.isActive !== false;
  const summary = summarizeClientProperties(propertiesState.properties, client.id);
  const propertiesReady = propertiesState.status === 'ready';
  const missingBilling = missingBillingData(client);

  const setActive = (isActive: boolean) => updateClient.mutate(
    { id: client.id, updates: { isActive }, successTitle: isActive ? 'Cliente reactivado' : 'Cliente inactivado' },
    { onSuccess: () => { setConfirmStatus(false); setConfirmDelete(false); } },
  );
  const closeDelete = (open: boolean) => { if (deleteClient.isPending) return; setConfirmDelete(open); if (!open) setTypedName(''); };

  return (
    <CrmDetailFrame title={client.nombre} subtitle={`CIF/NIF · ${client.cifNif || 'Sin indicar'}`} avatar={clientInitials(client.nombre)} status={active ? 'Activo' : 'Inactivo'}
      metricLabel="Propiedades" metricValue={propertiesReady ? summary.total : '—'}
      actions={<>
          {capabilities.canEdit && <EditClientModal key={client.id} client={client} canEditFiscal={capabilities.canEditFiscal} inheritingProperties={summary.inheriting.length} ownStateProperties={summary.ownState}
            trigger={<Button className="rounded-xl"><Edit className="mr-2 h-4 w-4" />Editar cliente</Button>} />}
          {capabilities.canEdit && <Button variant="outline" className="rounded-xl bg-white" disabled={updateClient.isPending} onClick={() => active ? setConfirmStatus(true) : setActive(true)}>
            <Power className="mr-2 h-4 w-4" />{active ? 'Inactivar' : 'Reactivar'}
          </Button>}
          {client.telefono && <Button asChild variant="outline" className="rounded-xl bg-white"><a href={`tel:${client.telefono}`}><Phone className="mr-2 h-4 w-4" />Llamar</a></Button>}
          {client.email && <Button asChild variant="outline" className="rounded-xl bg-white"><a href={`mailto:${client.email}`}><Mail className="mr-2 h-4 w-4" />Enviar email</a></Button>}
        </>}
      footer={capabilities.canDelete ? <div className="flex justify-end">
          <Button variant="ghost" className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Eliminar cliente</Button>
        </div> : undefined}
      tabs={[
        { id: 'profile', label: 'Ficha', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Contact className="h-4 w-4 text-[#310984]" />Contacto</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Teléfono">{client.telefono || 'Sin indicar'}</Field>
            <Field label="Email">{client.email || 'Sin indicar'}</Field>
            <Field label="Supervisor">{client.supervisor || 'Sin asignar'}</Field>
            <Field label="Ciudad">{client.ciudad || 'Sin indicar'}</Field>
          </dl>
        </section></> },
        { id: 'billing', label: 'Facturación', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Receipt className="h-4 w-4 text-[#310984]" />Facturación</h3>
          {missingBilling.length > 0 && <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Faltan datos de facturación: {missingBilling.join(', ')}.</p>}
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Dirección de facturación">{client.direccionFacturacion || 'Sin indicar'}</Field>
            <Field label="Código postal y ciudad">{[client.codigoPostal, client.ciudad].filter(Boolean).join(' · ') || 'Sin indicar'}</Field>
            <Field label="Método de pago">{CLIENT_PAYMENT_LABELS[client.metodoPago] || 'Sin indicar'}</Field>
            <Field label="Emisión de factura">{client.factura ? 'Con factura' : 'Sin factura'}</Field>
          </dl>
        </section></> },
        { id: 'service', label: 'Servicio', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Settings2 className="h-4 w-4 text-[#310984]" />Servicio y preferencias</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de servicio">{CLIENT_SERVICE_LABELS[client.tipoServicio] || client.tipoServicio || 'Sin indicar'}</Field>
            <Field label="Control de mudas">{client.linenControlEnabled ? 'Activado' : 'Desactivado'}</Field>
            <Field label="Gestión de amenities">{client.amenitiesControlEnabled !== false ? 'Activado' : 'Desactivado'}</Field>
            <Field label="Fotos visibles para el cliente">{client.photosVisibleToClient ? 'Sí' : 'No'}</Field>
          </dl>
        </section></> },
        { id: 'properties', label: 'Propiedades', content: <PropertiesTab client={client} state={propertiesState} summary={summary} /> },
        ...(capabilities.canManagePortal ? [{ id: 'portal', label: 'Portal', content: <ClientPortalSection clientId={client.id} clientName={client.nombre} /> }] : []),
      ]}
    >
      <AlertDialog open={confirmStatus} onOpenChange={open => !updateClient.isPending && setConfirmStatus(open)}>
        <AlertDialogContent className="w-[calc(100%-1rem)] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Inactivar a {client.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>Dejará de ofrecerse al crear tareas. No se borra ningún dato y puedes reactivarlo cuando quieras. No hace falta completar sus datos para inactivarlo.</AlertDialogDescription>
          </AlertDialogHeader>
          {propertiesReady ? <InactivationNotice inheriting={summary.inheriting.length} ownState={summary.ownState} /> : <p role="status" className="text-xs text-slate-500">{propertiesState.status === 'loading' ? 'Comprobando sus propiedades…' : 'No se han podido consultar sus propiedades: las que no tengan estado propio pasarán a inactivas.'}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateClient.isPending}>Cancelar</AlertDialogCancel>
            <Button disabled={updateClient.isPending} onClick={() => setActive(false)}>{updateClient.isPending ? 'Guardando…' : 'Inactivar cliente'}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={closeDelete}>
        <AlertDialogContent className="w-[calc(100%-1rem)] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {client.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>El borrado es definitivo. Para dejar de trabajar con un cliente, inactívalo: conserva sus propiedades y su histórico.</AlertDialogDescription>
          </AlertDialogHeader>
          {deletionCheck.isLoading || deletionCheck.isFetching ? <p role="status" className="text-sm text-slate-500">Comprobando registros relacionados…</p>
            : deletionCheck.isError || !deletionCheck.data || deletionCheck.data.status === 'unknown' ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                No se ha podido comprobar si tiene registros relacionados{deletionCheck.data?.status === 'unknown' ? ` (${deletionCheck.data.failed.join(', ')})` : ''}, así que no se puede eliminar.
                <Button variant="outline" size="sm" className="ml-2 bg-white" onClick={() => void deletionCheck.refetch()}>Reintentar</Button>
              </div>
            ) : deletionCheck.data.status === 'blocked' ? (
              <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-bold">No se puede eliminar: tiene registros relacionados.</p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5">{deletionCheck.data.items.map(item => <li key={item.key}>{item.count} {item.label}</li>)}</ul>
                <p className="mt-2 text-xs">Inactívalo para dejar de trabajar con él sin perder nada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">No tiene propiedades, tareas ni otros registros relacionados. Escribe <strong>{client.nombre}</strong> para confirmar.</p>
                <Input aria-label="Nombre del cliente para confirmar" value={typedName} onChange={event => setTypedName(event.target.value)} autoComplete="off" className="rounded-xl" />
              </div>
            )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClient.isPending}>Cancelar</AlertDialogCancel>
            {deletionCheck.data?.status === 'blocked' && active && capabilities.canEdit && <Button variant="outline" disabled={updateClient.isPending} onClick={() => setActive(false)}>Inactivar en su lugar</Button>}
            {deletionCheck.data?.status === 'allowed' && !deletionCheck.isFetching && (
              <Button variant="destructive" disabled={deleteClient.isPending || !deletionConfirmationMatches(typedName, client.nombre)} onClick={() => deleteClient.mutate(client.id, { onSuccess: () => closeDelete(false) })}>
                {deleteClient.isPending ? 'Eliminando…' : 'Eliminar definitivamente'}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CrmDetailFrame>
  );
}

function PropertiesTab({ client, state, summary }: { client: Client; state: ClientPropertiesState; summary: ReturnType<typeof summarizeClientProperties> }) {
  const active = client.isActive !== false;
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-950"><Home className="h-4 w-4 text-[#310984]" />Propiedades del cliente</h3>
        {state.status === 'ready' && summary.total > 0 && <Button asChild variant="outline" size="sm" className="rounded-lg"><Link to={`/properties?cliente=${encodeURIComponent(client.id)}`}>Ver en Propiedades<ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>}
      </div>
      {state.status === 'loading' ? <p role="status" className="text-sm text-slate-500">Cargando propiedades…</p>
        : state.status === 'error' ? <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">No se han podido cargar las propiedades.{state.retry && <Button variant="outline" size="sm" className="ml-2" onClick={state.retry}>Reintentar</Button>}</div>
        : summary.total === 0 ? <p className="text-sm text-slate-500">Este cliente no tiene propiedades en la sede activa.</p>
        : <>
          <p className="text-xs text-slate-500">{summary.total} {summary.total === 1 ? 'propiedad' : 'propiedades'} · {summary.inheriting.length} heredan el estado del cliente</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {summary.properties.map(property => {
              const effective = property.isActive ?? active;
              return (
                <li key={property.id} className="flex min-w-0 items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Link to={entityDetailPath('property', property.id)} className="block break-words text-sm font-bold text-slate-950 underline-offset-2 hover:text-[#310984] hover:underline">{property.nombre}</Link>
                    {property.codigo && <p className="text-xs text-slate-500">{property.codigo}</p>}
                  </div>
                  <span className={effective ? 'shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800' : 'shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600'}>
                    {effective ? 'Activa' : 'Inactiva'}{property.isActive == null ? ' · heredado' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-line break-words text-sm font-semibold text-slate-900">{children}</dd></div>;
}
