import { normalizeDirectorySearch } from '@/components/directory/directorySearch';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DirectoryEmpty, DirectoryPage, DirectorySearch, DirectorySegments } from '@/components/directory/DirectoryPage';
import { BuildingDetailPanel } from '@/components/buildings/BuildingDetailPanel';
import { buildingSetup, type BuildingDirectoryItem } from '@/components/buildings/buildingPresentation';
import { useToast } from '@/hooks/use-toast';
import { useDeviceType } from '@/hooks/use-mobile';
import { useCleaningPlanningBuildingData } from '@/hooks/useCleaningPlanningBuildingData';
import { useSupervisionBuildingCoverage } from '@/hooks/useSupervisionBuildingCoverage';
import { propertyGroupStorage } from '@/services/storage/propertyGroupStorage';
import { useSede } from '@/contexts/SedeContext';
import { cn } from '@/lib/utils';
import type { PropertyGroup } from '@/types/propertyGroups';

const initialBuildingForm = { name: '', internalCode: '', checkOutTime: '11:00', checkInTime: '17:00' };

export default function PlanningBuildingsIndex() {
  const { activeSede } = useSede();
  return <BuildingsWorkspace key={activeSede?.id || 'pending-sede'} />;
}

function BuildingsWorkspace() {
  const { data, isLoading, isError, refetch, isFetching } = useCleaningPlanningBuildingData();
  const coverageQuery = useSupervisionBuildingCoverage();
  const { isDesktop } = useDeviceType();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [setupFilter, setSetupFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [buildingForm, setBuildingForm] = useState(initialBuildingForm);
  const propertyGroups = useMemo(() => data?.propertyGroups || [], [data?.propertyGroups]);
  const propertyAssignments = useMemo(() => data?.propertyAssignments || [], [data?.propertyAssignments]);
  const cleanerAssignments = useMemo(() => data?.cleanerAssignments || [], [data?.cleanerAssignments]);
  const excludedAssignments = useMemo(() => data?.excludedCleanerAssignments || cleanerAssignments.filter(item => item.roleType === 'excluded'), [data?.excludedCleanerAssignments, cleanerAssignments]);
  const buildings = useMemo<BuildingDirectoryItem[]>(() => propertyGroups.map(group => {
    const team = cleanerAssignments.filter(item => item.propertyGroupId === group.id && item.roleType !== 'excluded');
    const propertyCount = propertyAssignments.filter(item => item.propertyGroupId === group.id).length;
    return {
      group, propertyCount, teamCount: team.length,
      excludedCount: excludedAssignments.filter(item => item.propertyGroupId === group.id).length,
      primaryCount: team.filter(item => !item.roleType || item.roleType === 'primary').length,
      secondaryCount: team.filter(item => item.roleType === 'secondary').length,
      backupCount: team.filter(item => item.roleType === 'backup').length,
      setup: buildingSetup(group, propertyCount, team.length), coverage: coverageQuery.data?.[group.id],
    };
  }).sort((a, b) => (a.group.displayName || a.group.name).localeCompare(b.group.displayName || b.group.name, 'es', { numeric: true, sensitivity: 'base' })), [propertyGroups, propertyAssignments, cleanerAssignments, excludedAssignments, coverageQuery.data]);
  const configured = buildings.filter(item => item.setup.rank === 3).length;
  const zones = [...new Set(propertyGroups.map(group => group.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const visible = buildings.filter(item => {
    const group = item.group;
    const matchesSearch = !searchTerm.trim() || [group.name, group.displayName, group.internalCode, group.zone, group.clientName, group.planningNotes].some(value => normalizeDirectorySearch(value).includes(normalizeDirectorySearch(searchTerm)));
    return matchesSearch && (setupFilter === 'all' || (setupFilter === 'configured' ? item.setup.rank === 3 : item.setup.rank < 3))
      && (zoneFilter === 'all' || (zoneFilter === 'unassigned' ? !group.zone : group.zone === zoneFilter));
  });
  const selected = visible.find(item => item.group.id === selectedId);
  const desktopBuilding = selected || visible[0];
  const hasFilters = !!searchTerm || setupFilter !== 'all' || zoneFilter !== 'all';
  const reset = () => { setSearchTerm(''); setSetupFilter('all'); setZoneFilter('all'); setSelectedId(null); };
  const count = (value: number) => isLoading || isError ? '—' : value;
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
      navigate(`/planning/buildings/${created.id}`);
    } catch (createBuildingError) {
      setCreateError(createBuildingError instanceof Error ? createBuildingError.message : 'No se pudo crear el edificio.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEmptyBuilding = async (group: PropertyGroup) => {
    const propertyCount = propertyAssignments.filter((assignment) => assignment.propertyGroupId === group.id).length;
    const teamCount = cleanerAssignments.filter((assignment) => assignment.propertyGroupId === group.id && assignment.roleType !== 'excluded').length;
    const excludedCount = excludedAssignments.filter((assignment) => assignment.propertyGroupId === group.id).length;

    if (!(propertyCount === 0 && teamCount === 0 && excludedCount === 0)) {
      toast({
        title: 'No se puede eliminar el edificio',
        description: 'Solo se pueden eliminar edificios completamente vacíos, sin propiedades, equipo ni personas marcadas como No aptas.',
        variant: 'destructive',
      });
      return;
    }

    setDeletingGroupId(group.id);
    try {
      await propertyGroupStorage.deleteEmptyPropertyGroup(group.id);
      await refetch();
      toast({
        title: 'Edificio eliminado',
        description: `${group.displayName || group.name} se eliminó correctamente.`,
      });
    } catch (deleteError) {
      toast({
        title: 'No se pudo eliminar el edificio',
        description: deleteError instanceof Error ? deleteError.message : 'Revisa permisos o relaciones pendientes e inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setDeletingGroupId(null);
    }
  };


  const detail = (item: BuildingDirectoryItem) => (
    <BuildingDetailPanel key={item.group.id} item={item} coverageLoading={coverageQuery.isLoading} coverageError={coverageQuery.isError} onRetryCoverage={() => void coverageQuery.refetch()} deleting={deletingGroupId === item.group.id} onDelete={() => handleDeleteEmptyBuilding(item.group)} />
  );

  return (
    <DirectoryPage title="Edificios" eyebrow="Centros operativos" description="Propiedades, equipo y supervisión en una única ficha." icon={Building2} actions={<>
      <Button className="rounded-xl" onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Añadir edificio</Button>
      <Button variant="outline" size="icon" className="rounded-xl" disabled={isFetching} aria-label="Actualizar edificios" onClick={() => { void refetch(); void coverageQuery.refetch(); }}><RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} /></Button>
    </>} stats={[
      { label: 'Edificios', value: count(buildings.length), helper: 'centros activos', tone: 'sky' },
      { label: 'Configurados', value: count(configured), helper: 'con asignación automática', tone: 'green' },
      { label: 'Por revisar', value: count(buildings.length - configured), helper: 'configuración pendiente', tone: 'muted' },
      { label: 'Propiedades', value: count(new Set(propertyAssignments.filter(assignment => propertyGroups.some(group => group.id === assignment.propertyGroupId)).map(assignment => assignment.propertyId)).size), helper: 'vinculadas a edificios', tone: 'violet' },
    ]}>
      <div className="grid items-stretch gap-4 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]">
        <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-270px)] lg:min-h-[640px]">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">Directorio de edificios</h2><p className="mt-1 text-sm text-slate-500">Selecciona un centro para ver su actividad.</p></div>{hasFilters && <Button variant="ghost" size="sm" onClick={reset}>Limpiar</Button>}</div>
            <DirectorySearch value={searchTerm} onChange={setSearchTerm} placeholder="Buscar edificio, código, zona o cliente" />
            <DirectorySegments value={setupFilter} onChange={setSetupFilter} options={[
              { value: 'all', label: 'Todos', count: count(buildings.length) },
              { value: 'configured', label: 'Configurados', count: count(configured) },
              { value: 'pending', label: 'Por revisar', count: count(buildings.length - configured) },
            ]} />
            <Select value={zoneFilter} onValueChange={setZoneFilter}><SelectTrigger aria-label="Filtrar por zona" className="rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las zonas</SelectItem><SelectItem value="unassigned">Sin zona asignada</SelectItem>{zones.map(zone => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="min-h-0 flex-1 px-3 pb-3 lg:overflow-y-auto">
            {isLoading ? <p role="status" className="py-10 text-center text-sm text-slate-500">Cargando edificios…</p> : isError ? (
              <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se han podido cargar los edificios.<Button variant="outline" className="mt-3" onClick={() => void refetch()}>Reintentar</Button></div>
            ) : !visible.length ? (
              <DirectoryEmpty title={buildings.length ? 'No hay coincidencias' : 'Todavía no hay edificios'} description={buildings.length ? 'Prueba con otro nombre o ajusta los filtros.' : 'Añade un edificio para vincular sus propiedades y configurar el equipo.'} action={hasFilters && <Button variant="outline" onClick={reset}>Limpiar filtros</Button>} />
            ) : <>
              <p aria-live="polite" className="pb-3 text-xs text-slate-500">{visible.length} de {buildings.length} edificios</p>
              <div className="space-y-2">
                {visible.map(item => {
                  const isSelected = item.group.id === (isDesktop ? desktopBuilding?.group.id : selected?.group.id);
                  return <button key={item.group.id} type="button" aria-pressed={isSelected} onClick={() => setSelectedId(item.group.id)} className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984] focus-visible:ring-offset-2',
                    isSelected ? 'border-[#310984]/30 bg-violet-50 ring-1 ring-[#310984]/20' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50',
                  )}>
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', isSelected ? 'bg-white text-[#310984]' : 'bg-slate-100 text-slate-600')}><Building2 className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-black leading-tight">{item.group.displayName || item.group.name}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{[item.group.internalCode, item.group.zone].filter(Boolean).join(' · ') || 'Sin zona asignada'}</span>
                      <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', item.setup.className)}>{item.setup.label}</span>
                      <span className="mt-1 block text-[11px] text-slate-500">{item.propertyCount} {item.propertyCount === 1 ? 'propiedad' : 'propiedades'} · {item.teamCount} {item.teamCount === 1 ? 'persona' : 'personas'}</span>
                    </span>
                    <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-slate-400" />
                  </button>;
                })}
              </div>
            </>}
          </div>
        </Card>
        {isDesktop && !isLoading && !isError && (desktopBuilding ? detail(desktopBuilding) : <DirectoryEmpty title="La actividad de tu edificio" description="Selecciona un centro para consultar su configuración, equipo y supervisión." />)}
      </div>
      {!isDesktop && <Dialog open={!!selected && !isLoading && !isError} onOpenChange={open => !open && setSelectedId(null)}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl p-0 pt-10"><DialogTitle className="sr-only">Ficha de {selected?.group.displayName || selected?.group.name}</DialogTitle><DialogDescription className="sr-only">Propiedades, equipo y supervisión del edificio.</DialogDescription>{selected && detail(selected)}</DialogContent></Dialog>}
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
                <p className="text-xs text-[#6b627a]">Debe ser único. Hermes lo utiliza para detectar y relacionar el edificio.</p>
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
    </DirectoryPage>
  );
}
