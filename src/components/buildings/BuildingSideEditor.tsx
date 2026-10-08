import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { propertyGroupStorage } from '@/services/storage/propertyGroupStorage';
import type { Cleaner } from '@/types/calendar';
import type { Property } from '@/types/property';
import type { PropertyGroupAssignment } from '@/types/propertyGroups';
import { buildingChangeCount, buildingRoles, createBuildingDraft, saveBuildingDraft, type BuildingDraft, type BuildingRole, type BuildingSnapshot } from './buildingDraft';

interface Props {
  groupId: string;
  cleaners: Cleaner[];
  properties: Property[];
  assignments: PropertyGroupAssignment[];
  readOnly?: boolean;
  onClose: () => void;
  onDeleted: () => void;
  onBusyChange: (dirty: boolean, saving: boolean) => void;
  onRefresh: () => Promise<unknown>;
}

export function BuildingSideEditor(props: Props) {
  const query = useQuery({
    queryKey: ['building-side-editor', props.groupId],
    queryFn: async (): Promise<BuildingSnapshot> => {
      const [groups, team, assignments] = await Promise.all([
        propertyGroupStorage.getPropertyGroups(), propertyGroupStorage.getCleanerAssignments(props.groupId), propertyGroupStorage.getAllPropertyAssignments(),
      ]);
      const group = groups.find(item => item.id === props.groupId);
      if (!group) throw new Error('El edificio ya no está disponible.');
      return { group, team, properties: assignments.filter(item => item.propertyGroupId === props.groupId) };
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  if (query.isError && !query.data) return <div role="alert" className="p-6">No se pudo cargar el edificio.<Button onClick={() => void query.refetch()}>Reintentar</Button><Button variant="ghost" onClick={props.onClose}>Cerrar</Button></div>;
  if (query.isLoading || !query.data) return <p role="status" className="p-6">Cargando equipo y propiedades…</p>;
  return <BuildingSideEditorForm {...props} snapshot={query.data} reload={async () => {
    const result = await query.refetch();
    if (result.error || !result.data) throw result.error || new Error('No se pudo recargar.');
    return result.data;
  }} />;
}

function BuildingSideEditorForm({ groupId, cleaners, properties, assignments, readOnly = false, snapshot, reload, onClose, onDeleted, onBusyChange, onRefresh }: Props & { snapshot: BuildingSnapshot; reload: () => Promise<BuildingSnapshot> }) {
  const [base, setBase] = useState(snapshot);
  const [draft, setDraft] = useState<BuildingDraft>(() => createBuildingDraft(snapshot));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [message, setMessage] = useState('');
  const [picker, setPicker] = useState<'team' | 'properties' | null>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const count = buildingChangeCount(base, draft);
  useEffect(() => { onBusyChange(count > 0 || needsReload, saving); }, [count, needsReload, saving, onBusyChange]);
  useEffect(() => {
    if (!count && !saving && !needsReload) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [count, saving, needsReload]);
  const reset = (value: BuildingSnapshot) => { setBase(value); setDraft(createBuildingDraft(value)); setPicker(null); setSearch(''); };
  const refreshCaches = async () => {
    await Promise.all(['property-groups', 'property-assignments', 'cleaner-assignments', 'cleaning-planning-building-data', 'operational-planning'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    await onRefresh();
  };
  const save = async () => {
    if (savingRef.current || readOnly || needsReload || !count) return;
    savingRef.current = true; setSaving(true); setMessage('');
    try {
      await saveBuildingDraft(propertyGroupStorage, base, draft);
      reset(await reload());
      await refreshCaches();
      setMessage('Cambios guardados.');
    } catch (error) {
      setNeedsReload(true);
      setMessage(`${error instanceof Error ? error.message : 'No se pudo completar el guardado.'} Puede haber cambios ya guardados. Recarga el estado para comprobarlo antes de volver a editar.`);
      await refreshCaches().catch(() => undefined);
    } finally { savingRef.current = false; setSaving(false); }
  };
  const reconcile = async () => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try { reset(await reload()); await refreshCaches(); setNeedsReload(false); setMessage('Estado actualizado. Revisa los cambios guardados antes de continuar.'); }
    catch { setMessage('No se pudo comprobar el estado. El guardado sigue bloqueado; vuelve a recargar cuando haya conexión.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const normalizedSearch = search.trim().toLocaleLowerCase('es');
  const availableCleaners = cleaners.filter(item => item.isActive && !draft.team.some(member => member.cleanerId === item.id) && item.name.toLocaleLowerCase('es').includes(normalizedSearch));
  const availableProperties = properties.filter(item => item.isActive !== false && item.clientIsActive !== false && !draft.propertyIds.includes(item.id) && !assignments.some(assignment => assignment.propertyId === item.id && assignment.propertyGroupId !== groupId) && `${item.codigo} ${item.nombre}`.toLocaleLowerCase('es').includes(normalizedSearch));
  const openPicker = (value: 'team' | 'properties') => { setPicker(picker === value ? null : value); setSearch(''); };
  const title = base.group.displayName || base.group.name;
  const deleteEmpty = async () => {
    if (savingRef.current || readOnly || count || needsReload || !window.confirm(`¿Eliminar el edificio vacío ${title}? Esta acción no se puede deshacer.`)) return;
    savingRef.current = true; setSaving(true);
    try { await propertyGroupStorage.deleteEmptyPropertyGroup(groupId); await refreshCaches(); onDeleted(); }
    catch { setNeedsReload(true); setMessage('No se pudo confirmar la eliminación. Recarga el estado antes de continuar.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <section aria-label={`Editar ${title}`} className="flex h-full min-h-0 flex-col bg-white">
    <header className="flex items-start justify-between gap-3 border-b border-violet-100 p-5">
      <div><h2 className="text-xl font-bold text-[#24123e]">Editar {title}</h2><p className="mt-1 text-sm text-slate-500">Equipo habitual y propiedades</p></div>
      <Button variant="ghost" size="icon" aria-label="Cerrar editor" disabled={saving} onClick={onClose}><X className="h-5 w-5" /></Button>
    </header>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
      <p className="text-xs text-slate-500">El equipo habitual orienta la planificación; no representa las tareas de hoy.</p>
      {readOnly && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No se ha podido cargar toda la información. Reintenta la carga del listado para seguir editando.</p>}
      <fieldset disabled={saving || needsReload || readOnly} className="min-w-0 space-y-6 disabled:opacity-60">
        <section aria-label="Equipo habitual"><h3 className="mb-3 font-semibold">Equipo habitual <span className="text-sm font-normal text-slate-500">({draft.team.length})</span></h3>
          <div className="space-y-3">{draft.team.map(member => {
            const worker = cleaners.find(item => item.id === member.cleanerId);
            const previous = base.team.find(item => item.cleanerId === member.cleanerId);
            const name = worker?.name || 'Persona no disponible';
            return <div key={member.cleanerId} className="flex items-center gap-2">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-[#310984]">{name.split(' ').slice(0, 2).map(part => part[0]).join('')}</span>
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{name}</p>{previous && !previous.isActive && <span className="text-xs text-amber-700">Vínculo inactivo</span>}</div>
              <select aria-label={`Rol de ${name}`} value={member.role} onChange={event => setDraft(current => ({ ...current, team: current.team.map(item => item.cleanerId === member.cleanerId ? { ...item, role: event.target.value as BuildingRole } : item) }))} className="h-10 w-28 rounded-lg border border-violet-200 bg-white px-2 text-sm focus:ring-2 focus:ring-violet-600">
                {Object.entries(buildingRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Button variant="ghost" size="icon" aria-label={`Retirar a ${name}`} onClick={() => setDraft(current => ({ ...current, team: current.team.filter(item => item.cleanerId !== member.cleanerId) }))}><Trash2 className="h-4 w-4 text-slate-500" /></Button>
            </div>;
          })}</div>
          {!draft.team.length && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Sin personal vinculado.</p>}
          <Button variant="outline" className="mt-4 w-full border-violet-200 text-[#310984]" onClick={() => openPicker('team')}><Plus className="mr-2 h-4 w-4" />Añadir persona</Button>
        </section>
        {picker === 'team' && <section className="rounded-xl border border-violet-200 bg-violet-50 p-3"><Input autoFocus aria-label="Buscar persona" placeholder="Buscar persona…" value={search} onChange={event => setSearch(event.target.value)} /><div className="mt-2 max-h-48 overflow-y-auto">{availableCleaners.map(worker => <button key={worker.id} type="button" className="block w-full rounded-lg p-3 text-left text-sm hover:bg-white" onClick={() => setDraft(current => ({ ...current, team: [...current.team, { cleanerId: worker.id, role: 'primary' }] }))}>+ {worker.name}</button>)}{!availableCleaners.length && <p className="p-3 text-sm">No hay personas disponibles con esta búsqueda.</p>}</div></section>}
        <section aria-label="Propiedades vinculadas" className="border-t border-violet-100 pt-5"><h3 className="mb-3 font-semibold">Propiedades vinculadas <span className="text-sm font-normal text-slate-500">({draft.propertyIds.length})</span></h3>
          <div className="flex flex-wrap gap-2">{draft.propertyIds.map(id => { const property = properties.find(item => item.id === id); const name = property?.codigo || property?.nombre || 'Propiedad no disponible'; return <span key={id} title={property?.nombre} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-violet-50 py-1 pl-3 text-sm text-[#310984]">{name}<button type="button" className="rounded p-2 hover:bg-violet-100" aria-label={`Desvincular ${name}`} onClick={() => setDraft(current => ({ ...current, propertyIds: current.propertyIds.filter(value => value !== id) }))}><X className="h-4 w-4" /></button></span>; })}</div>
          {!draft.propertyIds.length && <p className="text-sm text-amber-800">Sin propiedades vinculadas.</p>}
          <Button variant="outline" className="mt-4 w-full border-violet-200 text-[#310984]" onClick={() => openPicker('properties')}><Plus className="mr-2 h-4 w-4" />Vincular propiedades</Button>
          <p className="mt-2 text-xs text-slate-500">Desvincular no elimina la propiedad ni sus datos.</p>
        </section>
        {picker === 'properties' && <section className="rounded-xl border border-violet-200 bg-violet-50 p-3"><Input autoFocus aria-label="Buscar propiedad" placeholder="Código o nombre…" value={search} onChange={event => setSearch(event.target.value)} /><div className="mt-2 max-h-48 overflow-y-auto">{availableProperties.map(property => <button type="button" key={property.id} className="block w-full rounded-lg p-3 text-left text-sm hover:bg-white" onClick={() => setDraft(current => ({ ...current, propertyIds: [...current.propertyIds, property.id] }))}>+ {property.codigo} · {property.nombre}</button>)}{!availableProperties.length && <p className="p-3 text-sm">No hay propiedades libres con esta búsqueda.</p>}</div></section>}
        <section className="border-t border-violet-100 pt-5"><label htmlFor="building-supervisor" className="font-semibold">Supervisión de referencia</label><Input id="building-supervisor" className="mt-3" placeholder="Nombre de referencia" value={draft.supervisorName} onChange={event => setDraft(current => ({ ...current, supervisorName: event.target.value }))} /><p className="mt-2 text-xs text-slate-500">Dato informativo. Los accesos de supervisoras se gestionan en la ficha completa.</p></section>
      </fieldset>
      <Button variant="link" asChild className="px-0 text-[#310984]"><Link to={`/planning/buildings/${groupId}`} onClick={event => { if (saving || ((count > 0 || needsReload) && !window.confirm('¿Salir de este editor y descartar los cambios pendientes?'))) event.preventDefault(); }}><ExternalLink className="mr-2 h-4 w-4" />Abrir ficha completa y opciones avanzadas</Link></Button>
      {!base.team.length && !base.properties.length && <Button variant="ghost" className="text-red-700" disabled={saving || readOnly || !!count || needsReload} onClick={() => void deleteEmpty()}>Eliminar edificio vacío</Button>}
    </div>
    <footer className="space-y-3 border-t border-violet-200 bg-violet-50 p-4">
      {message && <p role={needsReload ? 'alert' : 'status'} className={`text-sm ${needsReload ? 'text-amber-900' : 'text-emerald-800'}`}>{message}</p>}
      <p aria-live="polite" className="text-xs font-medium text-[#310984]">{count ? `${count} cambio${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'}` : 'Sin cambios pendientes'}</p>
      {needsReload ? <Button className="w-full" disabled={saving} onClick={() => void reconcile()}>Recargar estado guardado</Button> : <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving || !count} onClick={() => { reset(base); setMessage(''); }}>Descartar</Button><Button className="bg-[#310984] hover:bg-[#4c1bb0]" disabled={saving || readOnly || !count} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button></div>}
    </footer>
  </section>;
}
