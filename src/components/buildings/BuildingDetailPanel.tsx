import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardCheck, Clock, Trash2 } from 'lucide-react';
import { CrmDetailFrame } from '@/components/directory/CrmDetailFrame';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { DetailField } from '@/components/directory/DirectoryPage';
import type { BuildingDirectoryItem } from './buildingPresentation';
import { cn } from '@/lib/utils';

export function BuildingDetailPanel({ item, coverageLoading, coverageError, onRetryCoverage, deleting, onDelete }: {
  item: BuildingDirectoryItem; coverageLoading: boolean; coverageError: boolean;
  onRetryCoverage: () => void; deleting: boolean; onDelete: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { group, setup, coverage } = item;
  const canDelete = item.propertyCount === 0 && item.teamCount === 0 && item.excludedCount === 0;
  return (
    <CrmDetailFrame title={group.displayName || group.name} subtitle={group.internalCode || 'Sin código'} avatar={<Building2 className="h-6 w-6" />} status={setup.label} metricLabel="Propiedades vinculadas" metricValue={item.propertyCount}
      actions={<><Button asChild className="rounded-xl"><Link to={`/planning/buildings/${group.id}`}>Abrir ficha completa<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></>}
      footer={<>{canDelete && <div className="flex justify-end"><Button variant="ghost" className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700" disabled={deleting} onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Eliminar edificio vacío</Button></div>}</>}
      tabs={[
        { id: 'profile', label: 'Ficha', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black"><Building2 className="h-4 w-4 text-[#310984]" />Información del edificio</h3>
          <dl className="grid gap-4  sm:grid-cols-2">
            <DetailField label="Cliente">{group.clientName || 'Sin indicar'}</DetailField>
            <DetailField label="Zona">{group.zone || 'Sin indicar'}</DetailField>
            <DetailField label="Supervisor de referencia">{group.supervisorName || 'Sin indicar'}</DetailField>
            <DetailField label="Asignación automática">{group.autoAssignEnabled ? 'Activada' : 'Desactivada'}</DetailField>
          </dl>
        </section>{(group.generalInstructions || group.planningNotes || group.description) && (<section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="text-sm font-black">Indicaciones</h3><dl className="mt-3 space-y-4 ">
            {group.generalInstructions && <DetailField label="Instrucciones generales">{group.generalInstructions}</DetailField>}
            {group.planningNotes && <DetailField label="Notas de planificación">{group.planningNotes}</DetailField>}
            {group.description && <DetailField label="Descripción">{group.description}</DetailField>}
          </dl></section>)}</> },
        { id: 'team', label: 'Equipo', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black"><Clock className="h-4 w-4 text-[#310984]" />Horarios y equipo</h3>
          <dl className="grid grid-cols-2 gap-4  sm:grid-cols-3">
            <DetailField label="Check-out">{group.checkOutTime?.slice(0, 5) || 'Sin indicar'}</DetailField>
            <DetailField label="Check-in">{group.checkInTime?.slice(0, 5) || 'Sin indicar'}</DetailField>
            <DetailField label="Titulares">{item.primaryCount}</DetailField>
            <DetailField label="Suplentes">{item.secondaryCount}</DetailField>
            <DetailField label="Apoyo">{item.backupCount}</DetailField>
            <DetailField label="Personas no aptas">{item.excludedCount}</DetailField>
          </dl>
          <p className={cn('mt-3 rounded-xl p-3 text-xs', setup.className)}>{setup.helper}</p>
        </section></> },
        { id: 'supervision', label: 'Supervisión', content: <><section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-black"><ClipboardCheck className="h-4 w-4 text-[#310984]" />Supervisión de hoy</h3>
          {coverageError ? <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No se ha podido cargar la supervisión.<Button variant="ghost" size="sm" onClick={onRetryCoverage}>Reintentar</Button></div> : coverageLoading ? <p role="status" className="mt-3 text-sm text-slate-500">Cargando supervisión…</p> : (
            <dl className="grid grid-cols-2 gap-4  sm:grid-cols-3">
              <DetailField label="Supervisores">{coverage?.assignedSupervisors || 0}</DetailField>
              <DetailField label="Pendientes">{coverage?.pending || 0}</DetailField>
              <DetailField label="En curso">{coverage?.inProgress || 0}</DetailField>
              <DetailField label="Completadas">{coverage?.completed || 0}</DetailField>
              <DetailField label="Aplazadas">{coverage?.deferred || 0}</DetailField>
              <DetailField label="Bloqueadas">{coverage?.blocked || 0}</DetailField>
            </dl>
          )}
        </section></> },
      ]}
    >
      <AlertDialog open={confirmDelete} onOpenChange={open => !deleting && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar {group.displayName || group.name}?</AlertDialogTitle><AlertDialogDescription>Este edificio no tiene propiedades, equipo ni personas marcadas como no aptas. Se eliminará permanentemente y esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={deleting} onClick={() => void onDelete()}>{deleting ? 'Eliminando…' : 'Sí, eliminar edificio'}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CrmDetailFrame>
  );}
