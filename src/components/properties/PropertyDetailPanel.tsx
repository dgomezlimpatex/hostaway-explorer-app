import { useState } from 'react';
import { CalendarDays, CheckSquare, Clock, Copy, Edit, Home, MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CrmDetailFrame } from '@/components/directory/CrmDetailFrame';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { DetailField } from '@/components/directory/DirectoryPage';
import { useCreateProperty, useDeleteProperty, usePropertyCleaningSchedule, type PropertyCleaningScheduleItem } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import type { Property } from '@/types/property';
import { EditPropertyModal } from './EditPropertyModal';
import { AssignChecklistModal } from './AssignChecklistModal';
import { PropertyChecklistInfo } from './PropertyChecklistInfo';
import { PropertyConsumptionsPanel } from './PropertyConsumptionsPanel';
import { duplicatePropertyData } from './duplicatePropertyData';
import { propertyBedCount, propertyDuration } from './propertyPresentation';

function cleaningDate(item?: PropertyCleaningScheduleItem | null) {
  if (!item?.date) return 'Sin registro';
  const [year, month, day] = item.date.split('-');
  return `${day}/${month}/${year}${item.startTime ? ` · ${item.startTime.slice(0, 5)}` : ''}`;
}

export function PropertyDetailPanel({ property, clientName, active }: { property: Property; clientName: string; active: boolean }) {
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const createProperty = useCreateProperty();
  const deleteProperty = useDeleteProperty();
  const { toast } = useToast();
  const schedule = usePropertyCleaningSchedule([property.id]);
  const cleaning = schedule.data?.[property.id];
  const duplicate = async () => {
    try {
      await createProperty.mutateAsync(duplicatePropertyData(property));
      toast({ title: 'Propiedad duplicada', description: `Se ha creado una copia de «${property.nombre}».` });
    } catch { /* The mutation displays its error toast. */ }
  };

  return (
    <CrmDetailFrame title={property.nombre} subtitle={`${property.codigo || 'Sin código'} · ${clientName}`} avatar={<Home className="h-6 w-6" />} status={active ? 'Activa' : 'Inactiva'} metricLabel="Duración del servicio" metricValue={propertyDuration(property.duracionServicio)}
      actions={<>
          <Button onClick={() => setEditing(true)} className="rounded-xl"><Edit className="mr-2 h-4 w-4" />Editar propiedad</Button>
          <Button variant="outline" onClick={() => setAssigning(true)} className="rounded-xl bg-white"><CheckSquare className="mr-2 h-4 w-4" />Asignar checklist</Button>
          <Button variant="outline" disabled={createProperty.isPending} onClick={() => void duplicate()} className="rounded-xl bg-white"><Copy className="mr-2 h-4 w-4" />{createProperty.isPending ? 'Duplicando…' : 'Duplicar'}</Button>
        </>}
      footer={<><div className="flex justify-end">
          <Button variant="ghost" onClick={() => setDeleting(true)} className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="mr-2 h-4 w-4" />Eliminar propiedad</Button>
        </div></>}
      tabs={[
        { id: 'profile', label: 'Ficha', content: <><div className="flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#310984]" /><p className="whitespace-pre-line break-words">{property.direccion || 'Sin dirección'}</p></div><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black"><Clock className="h-4 w-4 text-[#310984]" />Servicio y horarios</h3>
          <dl className="grid grid-cols-2 gap-4 ">
            <DetailField label="Duración estimada">{propertyDuration(property.duracionServicio)}</DetailField>
            <DetailField label="Coste del servicio">{(property.costeServicio || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</DetailField>
            <DetailField label="Check-out">{property.checkOutPredeterminado?.slice(0, 5) || 'Sin indicar'}</DetailField>
            <DetailField label="Check-in">{property.checkInPredeterminado?.slice(0, 5) || 'Sin indicar'}</DetailField>
          </dl>
        </section><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black"><Home className="h-4 w-4 text-[#310984]" />Características</h3>
          <dl className="grid grid-cols-2 gap-4  sm:grid-cols-3">
            <DetailField label="Camas en total">{propertyBedCount(property)}</DetailField>
            <DetailField label="Baños">{property.numeroBanos || 0}</DetailField>
            <DetailField label="Cocinas">{property.numeroCocinas ?? 1}</DetailField>
            <DetailField label="Camas estándar">{property.numeroCamas || 0}</DetailField>
            <DetailField label="Camas pequeñas / suite">{property.numeroCamasPequenas || 0} / {property.numeroCamasSuite || 0}</DetailField>
            <DetailField label="Sofás cama">{property.numeroSofasCama || 0}</DetailField>
          </dl>
        </section></> },
        { id: 'consumption', label: 'Consumos', content: <PropertyConsumptionsPanel property={property} onEdit={() => setEditing(true)} /> },
        { id: 'cleaning', label: 'Limpiezas', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black"><CalendarDays className="h-4 w-4 text-[#310984]" />Limpiezas</h3>
          {schedule.isError ? <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No se han podido cargar las fechas.<Button variant="ghost" size="sm" onClick={() => void schedule.refetch()}>Reintentar</Button></div> : (
            <dl className="grid gap-4  sm:grid-cols-2">
              <DetailField label="Última limpieza">{schedule.isLoading ? 'Cargando…' : cleaningDate(cleaning?.lastCleaning)}</DetailField>
              <DetailField label="Próxima limpieza">{schedule.isLoading ? 'Cargando…' : cleaningDate(cleaning?.nextCleaning)}</DetailField>
            </dl>
          )}
        </section></> },
        { id: 'checklist', label: 'Checklist', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black"><CheckSquare className="h-4 w-4 text-[#310984]" />Checklist e indicaciones</h3>
          <div className="overflow-hidden  [&_div]:flex-wrap [&_span]:break-words"><PropertyChecklistInfo propertyId={property.id} /></div>
          <p className="whitespace-pre-line break-words  text-sm text-slate-600">{property.notas || 'Sin notas para esta propiedad.'}</p>
          <p className="text-xs text-slate-500">En «Editar propiedad» puedes gestionar el personal preferente.</p>
        </section></> },
      ]}
    >
      {editing && <EditPropertyModal property={property} open onOpenChange={setEditing} />}
      {assigning && <AssignChecklistModal property={property} open onOpenChange={setAssigning} />}
      <AlertDialog open={deleting} onOpenChange={open => !deleteProperty.isPending && setDeleting(open)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar {property.nombre}?</AlertDialogTitle><AlertDialogDescription>Esta acción elimina permanentemente la propiedad y no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProperty.isPending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteProperty.isPending} onClick={() => deleteProperty.mutate(property.id, { onSuccess: () => setDeleting(false) })}>{deleteProperty.isPending ? 'Eliminando…' : 'Eliminar propiedad'}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CrmDetailFrame>
  );}
