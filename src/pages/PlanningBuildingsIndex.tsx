import { useCallback, useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Building2, Loader2, Plus, RefreshCw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DirectoryEmpty, DirectoryPage, DirectorySearch } from '@/components/directory/DirectoryPage';
import { normalizeDirectorySearch } from '@/components/directory/directorySearch';
import { BuildingSideEditor } from '@/components/buildings/BuildingSideEditor';
import { buildingRoles } from '@/components/buildings/buildingDraft';
import { useToast } from '@/hooks/use-toast';
import { useDeviceType } from '@/hooks/use-mobile';
import { useCleaningPlanningBuildingData } from '@/hooks/useCleaningPlanningBuildingData';
import { useCleaners } from '@/hooks/useCleaners';
import { useProperties } from '@/hooks/useProperties';
import { propertyGroupStorage } from '@/services/storage/propertyGroupStorage';
import { useSede } from '@/contexts/SedeContext';
import { cn } from '@/lib/utils';

const initialBuildingForm = { name: '', internalCode: '', checkOutTime: '11:00', checkInTime: '17:00' };
export default function PlanningBuildingsIndex() {
  const { activeSede } = useSede();
  return <BuildingsWorkspace key={activeSede?.id || 'pending-sede'} />;
}
function BuildingsWorkspace() {
  const { data, isLoading, isError, refetch, isFetching } = useCleaningPlanningBuildingData();
  const cleanersQuery = useCleaners();
  const propertiesQuery = useProperties();
  const { isDesktop } = useDeviceType();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const onBusyChange = useCallback((nextDirty: boolean, nextSaving: boolean) => { setDirty(nextDirty); setSaving(nextSaving); }, []);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [buildingForm, setBuildingForm] = useState(initialBuildingForm);
  const propertyGroups = useMemo(() => data?.propertyGroups || [], [data?.propertyGroups]);
  const propertyAssignments = useMemo(() => data?.propertyAssignments || [], [data?.propertyAssignments]);
  const cleanerAssignments = useMemo(() => data?.cleanerAssignments || [], [data?.cleanerAssignments]);
  const cleanersById = useMemo(() => new Map(cleanersQuery.cleaners.map(item => [item.id, item])), [cleanersQuery.cleaners]);
  const propertiesById = useMemo(() => new Map((propertiesQuery.data || []).map(item => [item.id, item])), [propertiesQuery.data]);
  const buildings = useMemo(() => propertyGroups.map(group => ({
    group,
    team: cleanerAssignments.filter(item => item.propertyGroupId === group.id && item.roleType !== 'excluded'),
    properties: propertyAssignments.filter(item => item.propertyGroupId === group.id),
  })).sort((a, b) => (a.group.displayName || a.group.name).localeCompare(b.group.displayName || b.group.name, 'es', { numeric: true })), [propertyGroups, cleanerAssignments, propertyAssignments]);
  const zones = [...new Set(propertyGroups.map(group => group.zone).filter(Boolean))].sort();
  const visible = buildings.filter(item => {
    const fields = [item.group.name, item.group.displayName, item.group.internalCode, item.group.zone, item.group.clientName, item.group.supervisorName,
      ...item.team.map(member => cleanersById.get(member.cleanerId)?.name),
      ...item.properties.flatMap(assignment => { const property = propertiesById.get(assignment.propertyId); return [property?.codigo, property?.nombre]; })];
    return fields.some(value => normalizeDirectorySearch(value).includes(normalizeDirectorySearch(searchTerm)))
      && (zoneFilter === 'all' || (zoneFilter === 'unassigned' ? !item.group.zone : item.group.zone === zoneFilter))
      && (statusFilter === 'all' || (statusFilter === 'no-primary' ? !item.team.some(member => !member.roleType || member.roleType === 'primary') : item.properties.length === 0));
  });
  const selected = buildings.find(item => item.group.id === selectedId);
  const loading = isLoading || cleanersQuery.isLoading || propertiesQuery.isLoading;
  const failed = isError || !!cleanersQuery.error || propertiesQuery.isError;
  const selectBuilding = (id: string | null) => {
    if (id === selectedId || saving) return;
    if (dirty && !window.confirm('Hay cambios pendientes. ¿Descartarlos y continuar?')) return;
    setDirty(false); setSelectedId(id);
  };
  useEffect(() => {
    if (!dirty && !saving) return;
    const guard = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest('a[href]');
      if (!anchor || anchor.closest('[data-building-editor]')) return;
      if (saving || !window.confirm('Hay cambios pendientes. ¿Salir y descartarlos?')) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener('click', guard, true);
    return () => document.removeEventListener('click', guard, true);
  }, [dirty, saving]);
  const refresh = async () => { const results = await Promise.all([refetch(), cleanersQuery.refetch(), propertiesQuery.refetch()]); if (results.some(result => result.error)) throw new Error('No se pudo actualizar el listado.'); };
  const handleCreateBuilding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = buildingForm.name.trim();
    const internalCode = buildingForm.internalCode.trim();

    if (!name || !internalCode) {
      setCreateError('El nombre y el código interno son obligatorios.');
      return;
    }
    if (buildingForm.checkInTime <= buildingForm.checkOutTime) {
      setCreateError('El check-in debe ser posterior al check-out.');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    try {
      const created = await propertyGroupStorage.createPropertyGroup({
        name,
        internalCode,
        displayName: name,
        checkOutTime: buildingForm.checkOutTime,
        checkInTime: buildingForm.checkInTime,
        isActive: true,
        autoAssignEnabled: false,
      });
      await refetch();
      setBuildingForm(initialBuildingForm);
      setIsCreateOpen(false);
      toast({ title: 'Edificio creado', description: 'Ahora puedes vincular propiedades y configurar su equipo.' });
      setSelectedId(created.id);
    } catch (createBuildingError) {
      setCreateError(createBuildingError instanceof Error ? createBuildingError.message : 'No se pudo crear el edificio.');
    } finally {
      setIsCreating(false);
    }
  };

  const editor = selected ? <BuildingSideEditor key={selected.group.id} groupId={selected.group.id} readOnly={failed || loading} cleaners={cleanersQuery.cleaners} properties={propertiesQuery.data || []} assignments={propertyAssignments} onClose={() => selectBuilding(null)} onDeleted={() => { setSelectedId(null); setDirty(false); setSaving(false); }} onBusyChange={onBusyChange} onRefresh={refresh} /> : null;
  return <DirectoryPage title="Edificios" eyebrow="Centros operativos" description="Equipo y propiedades a la vista. Edita sin perder el conjunto." icon={Building2} showStats={false} actions={<>
    <Button className="bg-[#310984] hover:bg-[#4c1bb0]" disabled={dirty || saving} onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Añadir edificio</Button>
    <Button variant="outline" size="icon" disabled={dirty || saving || isFetching} aria-label="Actualizar edificios" onClick={() => void refresh().catch(() => toast({ title: 'No se pudo actualizar', variant: 'destructive' }))}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} /></Button>
  </>}>
    <div className={cn('grid items-start gap-5', selected && isDesktop && 'lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] 2xl:grid-cols-[minmax(0,1fr)_460px]')}>
      <div className="min-w-0 space-y-4">
        <DirectorySearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar edificio, persona o propiedad…" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-500">Zona<select aria-label="Filtrar por zona" value={zoneFilter} onChange={event => setZoneFilter(event.target.value)} className="ml-2 h-10 rounded-lg border border-violet-100 bg-white px-3 text-sm text-slate-800"><option value="all">Todas las zonas</option><option value="unassigned">Sin zona asignada</option>{zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
          <label className="text-xs text-slate-500">Estado<select aria-label="Filtrar por estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="ml-2 h-10 rounded-lg border border-violet-100 bg-white px-3 text-sm text-slate-800"><option value="all">Todos</option><option value="no-primary">Sin titular</option><option value="no-properties">Sin propiedades</option></select></label>
          {(searchTerm || zoneFilter !== 'all' || statusFilter !== 'all') && <Button variant="link" className="text-[#310984]" onClick={() => { setSearchTerm(''); setZoneFilter('all'); setStatusFilter('all'); }}>Limpiar filtros</Button>}
        </div>
        {loading ? <p role="status" className="p-8">Cargando edificios, personal y propiedades…</p> : failed ? <div role="alert" className="rounded-xl bg-amber-50 p-5 text-amber-900">No se pudo cargar toda la información. No se pueden editar datos incompletos.<Button variant="outline" className="mt-3 block" onClick={() => void refresh().catch(() => undefined)}>Reintentar</Button></div> : <>
          <p aria-live="polite" className="text-xs text-slate-500">{visible.length} de {buildings.length} edificios · Equipo habitual</p>
          <div className="hidden grid-cols-[minmax(130px,1fr)_minmax(180px,1.6fr)_minmax(100px,1fr)_24px] gap-3 px-4 text-xs font-semibold text-slate-500 md:grid"><span>Edificio</span><span>Equipo habitual</span><span>Propiedades</span><span /></div>
          <div className="space-y-2">{visible.map(item => <button type="button" key={item.group.id} aria-label={`Editar ${item.group.displayName || item.group.name}`} aria-pressed={selectedId === item.group.id} disabled={saving} onClick={() => selectBuilding(item.group.id)} className={cn('grid w-full gap-3 rounded-xl border bg-white p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984] md:grid-cols-[minmax(130px,1fr)_minmax(180px,1.6fr)_minmax(100px,1fr)_24px]', selectedId === item.group.id ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-200' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50')}>
            <span className="min-w-0"><span className="block break-words font-bold text-[#24123e]">{item.group.displayName || item.group.name}</span><span className="mt-1 block text-xs text-slate-500">{[item.group.internalCode, item.group.zone].filter(Boolean).join(' · ') || 'Sin zona asignada'}</span>{item.group.supervisorName && <span className="mt-2 block text-xs text-slate-500">Referencia: {item.group.supervisorName}</span>}</span>
            <span className="flex flex-wrap content-start gap-2">{!item.team.some(member => !member.roleType || member.roleType === 'primary') && <span className="self-start rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Sin titular</span>}{item.team.map(member => <span key={member.id} className="inline-flex items-center gap-2 rounded-lg bg-white/80 px-2 py-1"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-[#310984]">{(cleanersById.get(member.cleanerId)?.name || '?').slice(0, 1)}</span><span><span className="block text-xs font-medium">{cleanersById.get(member.cleanerId)?.name || 'Persona no disponible'}</span><span className="block text-[11px] text-slate-500">{buildingRoles[member.roleType || 'primary']}</span></span></span>)}</span>
            <span><span className="block text-xs font-semibold">{item.properties.length} propiedades</span><span className="mt-2 flex flex-wrap gap-1">{item.properties.slice(0, 4).map(assignment => <span key={assignment.id} className="rounded bg-violet-100/60 px-2 py-1 text-[11px] text-[#310984]">{propertiesById.get(assignment.propertyId)?.codigo || 'Sin código'}</span>)}{item.properties.length > 4 && <span className="rounded bg-violet-100/60 px-2 py-1 text-[11px]">+{item.properties.length - 4}</span>}</span></span>
            <Pencil aria-hidden="true" className="hidden h-4 w-4 self-center text-[#310984] md:block" />
          </button>)}</div>
          {!visible.length && <DirectoryEmpty title={buildings.length ? 'No hay coincidencias' : 'Todavía no hay edificios'} description="Añade un edificio o ajusta los filtros para continuar." />}
        </>}
      </div>
      <Dialog open={!!editor} modal={false} onOpenChange={open => { if (!open) selectBuilding(null); }}>
        {!isDesktop && editor && <div key="overlay" aria-hidden="true" className="fixed inset-0 z-50 bg-black/40" />}
        {editor && <DialogPrimitive.Content key="editor" aria-modal={!isDesktop} data-building-editor onKeyDown={event => {
          if (isDesktop || event.key !== 'Tab') return;
          const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length);
          const first = elements[0], last = elements[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }} onInteractOutside={event => { if (isDesktop || saving) event.preventDefault(); }} onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onOpenAutoFocus={event => { if (isDesktop) event.preventDefault(); }} className="fixed inset-x-2 top-[4dvh] z-50 h-[92dvh] overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm outline-none lg:sticky lg:inset-x-auto lg:top-4 lg:z-auto lg:h-[calc(100dvh-130px)] lg:min-h-[520px]">
          <DialogTitle className="sr-only">Editar edificio</DialogTitle><DialogDescription className="sr-only">Personal y propiedades del edificio seleccionado</DialogDescription>{editor}
        </DialogPrimitive.Content>}
      </Dialog>
    </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          if (isCreating) return;
          setIsCreateOpen(open);
          if (!open) {
            setCreateError('');
            setBuildingForm(initialBuildingForm);
          }
        }}>
          <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Añadir edificio</DialogTitle>
              <DialogDescription>Crea el centro operativo y continúa en su ficha para vincular propiedades y equipo.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreateBuilding}>
              <div className="space-y-2">
                <Label htmlFor="building-name">Nombre del edificio</Label>
                <Input id="building-name" autoFocus value={buildingForm.name} onChange={(event) => setBuildingForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Marina 30" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="building-code">Código interno</Label>
                <Input id="building-code" value={buildingForm.internalCode} onChange={(event) => setBuildingForm((current) => ({ ...current, internalCode: event.target.value }))} placeholder="Ej. M30" required />
                <p className="text-xs text-[#6b627a]">Debe ser único. La app lo utiliza para detectar y relacionar el edificio.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="building-checkout">Check-out</Label>
                  <Input id="building-checkout" type="time" value={buildingForm.checkOutTime} onChange={(event) => setBuildingForm((current) => ({ ...current, checkOutTime: event.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="building-checkin">Check-in</Label>
                  <Input id="building-checkin" type="time" value={buildingForm.checkInTime} onChange={(event) => setBuildingForm((current) => ({ ...current, checkInTime: event.target.value }))} required />
                </div>
              </div>
              {createError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{createError}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancelar</Button>
                <Button type="submit" className="bg-[#310984] text-white hover:bg-[#4c1bb0]" disabled={isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear edificio
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
  </DirectoryPage>;
}
