import { useEffect, useState } from 'react';
import { CalendarDays, CheckSquare, Copy, Save, Home, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CrmDetailFrame } from '@/components/directory/CrmDetailFrame';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { DetailField } from '@/components/directory/DirectoryPage';
import { useCreateProperty, useDeleteProperty, usePropertyCleaningSchedule, type PropertyCleaningScheduleItem } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import type { Property } from '@/types/property';
import { Form } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PropertyPreferredCleaners } from './PropertyPreferredCleaners';
import { applyDefaultPropertyConsumptionsToForm } from './forms/propertyStockConsumption';
import { useStockProducts } from '@/hooks/useStock';
import { BasicInfoSection } from './forms/BasicInfoSection';
import { CharacteristicsSection } from './forms/CharacteristicsSection';
import { ServiceSection } from './forms/ServiceSection';
import { ClientSelectionSection } from './forms/ClientSelectionSection';
import { NotesSection } from './forms/NotesSection';
import { StockConsumptionSection } from './forms/StockConsumptionSection';
import { usePropertyInlineEdit } from './usePropertyInlineEdit';
import { AssignChecklistModal } from './AssignChecklistModal';
import { PropertyChecklistInfo } from './PropertyChecklistInfo';
import { duplicatePropertyData } from './duplicatePropertyData';
import { propertyDuration } from './propertyPresentation';

function cleaningDate(item?: PropertyCleaningScheduleItem | null) {
  if (!item?.date) return 'Sin registro';
  const [year, month, day] = item.date.split('-');
  return `${day}/${month}/${year}${item.startTime ? ` · ${item.startTime.slice(0, 5)}` : ''}`;
}

export function PropertyDetailPanel({ property, clientName, active, onPendingChange }: { property: Property; clientName: string; active: boolean; onPendingChange?: (pending: boolean, saving: boolean, discard: () => void, id: string) => void }) {
  const editor = usePropertyInlineEdit(property);
  const products = useStockProducts();
  const [preferredOpen, setPreferredOpen] = useState(false);
  useEffect(() => {
    onPendingChange?.(editor.dirty, editor.saving, editor.discard, property.id);
    return () => onPendingChange?.(false, false, () => {}, property.id);
  }, [editor.dirty, editor.saving, editor.discard, property.id, onPendingChange]);
  const section = (content: React.ReactNode) => <fieldset disabled={!editor.ready || editor.saving || editor.loadError} className="min-w-0 space-y-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 [&_h3]:text-[#310984]">{content}</fieldset>;
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
    <Form {...editor.form}>
    <CrmDetailFrame variant="properties" title={property.nombre} subtitle={<><span>{property.codigo || 'Sin código'}</span><span aria-hidden="true">·</span><span>{clientName}</span></>} avatar={<Home aria-hidden="true" className="h-6 w-6" />} status={active ? 'Activa' : 'Inactiva'} metricLabel="Duración del servicio" metricValue={propertyDuration(property.duracionServicio)}
      actions={<>
          <Button disabled={!editor.dirty || !editor.ready || editor.saving || editor.loadError} onClick={() => void editor.save()} className="rounded-xl"><Save className="mr-2 h-4 w-4" />{editor.saving ? 'Guardando…' : 'Guardar cambios'}</Button>
          <Button variant="outline" disabled={!editor.dirty || editor.saving} onClick={editor.discard}>Descartar</Button>
          <span role="status" className="w-full text-sm text-slate-600">{editor.message || (editor.dirty ? 'Cambios sin guardar' : 'Edita directamente los campos de cada pestaña.')}</span>
          {editor.loadError && <div role="alert" className="w-full text-sm text-amber-800">No se han podido cargar los consumos. <Button variant="ghost" onClick={editor.retry}>Reintentar</Button></div>}
          {!editor.ready && !editor.loadError && <p role="status">Cargando datos de edición…</p>}
          <Button variant="outline" disabled={editor.dirty || editor.saving} onClick={() => setAssigning(true)} className="rounded-xl bg-white"><CheckSquare className="mr-2 h-4 w-4" />Asignar checklist</Button>
          <Button variant="outline" disabled={editor.dirty || editor.saving} onClick={() => setPreferredOpen(true)}>Personal preferente</Button>
          <Button variant="outline" disabled={createProperty.isPending || editor.dirty || editor.saving} onClick={() => void duplicate()} className="rounded-xl bg-white"><Copy className="mr-2 h-4 w-4" />{createProperty.isPending ? 'Duplicando…' : 'Duplicar'}</Button>
        </>}
      footer={<><div className="flex justify-end">
          <Button variant="ghost" disabled={editor.dirty || editor.saving} onClick={() => setDeleting(true)} className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="mr-2 h-4 w-4" />Eliminar propiedad</Button>
        </div></>}
      tabs={[
        { id: 'profile', label: 'Ficha', content: section(<><BasicInfoSection control={editor.form.control} /><CharacteristicsSection control={editor.form.control} /><ServiceSection control={editor.form.control} /><ClientSelectionSection control={editor.form.control} /></>) },
        { id: 'consumption', label: 'Consumos', content: section(<><p className="text-sm text-slate-600">Las cantidades se guardarán al pulsar «Guardar cambios».</p><Button variant="outline" onClick={() => applyDefaultPropertyConsumptionsToForm(editor.form.setValue, products.data || [], { ...property, ...editor.form.getValues() })}>Recalcular consumos</Button><StockConsumptionSection control={editor.form.control} setValue={editor.form.setValue} property={property} initialize={false} /></>) },
        { id: 'cleaning', label: 'Limpiezas', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays aria-hidden="true" className="h-4 w-4 text-[#310984]" />Limpiezas</h3>
          {schedule.isError ? <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No se han podido cargar las fechas.<Button variant="ghost" size="sm" onClick={() => void schedule.refetch()}>Reintentar</Button></div> : (
            <dl className="grid gap-4  sm:grid-cols-2">
              <DetailField label="Última limpieza">{schedule.isLoading ? 'Cargando…' : cleaningDate(cleaning?.lastCleaning)}</DetailField>
              <DetailField label="Próxima limpieza">{schedule.isLoading ? 'Cargando…' : cleaningDate(cleaning?.nextCleaning)}</DetailField>
            </dl>
          )}
        </section></> },
        { id: 'checklist', label: 'Checklist', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CheckSquare aria-hidden="true" className="h-4 w-4 text-[#310984]" />Checklist e indicaciones</h3>
          <div className="overflow-hidden  [&_div]:flex-wrap [&_span]:break-words"><PropertyChecklistInfo propertyId={property.id} /></div>
          {section(<NotesSection control={editor.form.control} />)}

        </section></> },
      ]}
    >
      {assigning && <AssignChecklistModal property={property} open onOpenChange={setAssigning} />}
      <Dialog open={preferredOpen} onOpenChange={setPreferredOpen}>
        <DialogContent><DialogHeader><DialogTitle>Personal preferente</DialogTitle><DialogDescription>Las acciones de añadir, quitar y copiar se guardan al realizarlas.</DialogDescription></DialogHeader><PropertyPreferredCleaners propertyId={property.id} /></DialogContent>
      </Dialog>
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
    </Form>
  );}
