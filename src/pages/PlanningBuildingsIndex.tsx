import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, Home, Loader2, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCleaningPlanningBuildingData } from '@/hooks/useCleaningPlanningBuildingData';
import { propertyGroupStorage } from '@/services/storage/propertyGroupStorage';
import type { PropertyGroup } from '@/types/propertyGroups';

const getSetupState = (
  group: PropertyGroup,
  propertyCount: number,
  teamCount: number,
) => {
  if (propertyCount === 0) {
    return {
      rank: 0,
      label: 'Faltan propiedades',
      helper: 'Vincula apartamentos/propiedades antes de automatizar.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }

  if (teamCount === 0) {
    return {
      rank: 1,
      label: 'Falta equipo',
      helper: 'Añade titulares, suplentes, backups o No aptas.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }

  if (!group.autoAssignEnabled) {
    return {
      rank: 2,
      label: 'Listo para probar',
      helper: 'Ya tiene base operativa; prueba propuesta revisable.',
      className: 'border-sky-200 bg-sky-50 text-sky-800',
    };
  }

  return {
    rank: 3,
    label: 'Configurado',
    helper: 'Tiene propiedades, equipo y auto-asignación activada.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
};

const normalize = (value?: string | null) => (value || '').toLowerCase().trim();

const initialBuildingForm = { name: '', internalCode: '', checkOutTime: '11:00', checkInTime: '17:00' };

const PlanningBuildingsIndex = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useCleaningPlanningBuildingData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [buildingForm, setBuildingForm] = useState(initialBuildingForm);
  const propertyGroups = useMemo(() => data?.propertyGroups || [], [data?.propertyGroups]);
  const propertyAssignments = useMemo(() => data?.propertyAssignments || [], [data?.propertyAssignments]);
  const cleanerAssignments = useMemo(() => data?.cleanerAssignments || [], [data?.cleanerAssignments]);

  const buildingCards = useMemo(() => {
    const query = normalize(searchTerm);

    return propertyGroups
      .map((group) => {
        const propertyCount = propertyAssignments.filter((assignment) => assignment.propertyGroupId === group.id).length;
        const teamCount = cleanerAssignments.filter((assignment) => assignment.propertyGroupId === group.id && assignment.roleType !== 'excluded').length;
        const excludedCount = cleanerAssignments.filter((assignment) => assignment.propertyGroupId === group.id && assignment.roleType === 'excluded').length;
        const setup = getSetupState(group, propertyCount, teamCount);
        const searchable = [group.name, group.displayName, group.internalCode, group.zone, group.clientName, group.planningNotes].map(normalize).join(' ');
        return { group, propertyCount, teamCount, excludedCount, setup, matches: !query || searchable.includes(query) };
      })
      .filter((item) => item.matches)
      .sort((a, b) => a.setup.rank - b.setup.rank || (a.group.displayName || a.group.name).localeCompare(b.group.displayName || b.group.name, 'es', { numeric: true }));
  }, [cleanerAssignments, propertyAssignments, propertyGroups, searchTerm]);

  const setupStats = useMemo(() => {
    const cards = propertyGroups.map((group) => {
      const propertyCount = propertyAssignments.filter((assignment) => assignment.propertyGroupId === group.id).length;
      const teamCount = cleanerAssignments.filter((assignment) => assignment.propertyGroupId === group.id && assignment.roleType !== 'excluded').length;
      return getSetupState(group, propertyCount, teamCount);
    });

    return {
      total: propertyGroups.length,
      needsSetup: cards.filter((card) => card.rank <= 1).length,
      readyToTest: cards.filter((card) => card.rank === 2).length,
      configured: cards.filter((card) => card.rank === 3).length,
    };
  }, [cleanerAssignments, propertyAssignments, propertyGroups]);

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
    const excludedCount = cleanerAssignments.filter((assignment) => assignment.propertyGroupId === group.id && assignment.roleType === 'excluded').length;

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

  return (
    <div className="min-h-screen bg-[#f7f4fb] px-4 py-5 text-[#171321] md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(244,211,94,0.20),_transparent_34%),linear-gradient(135deg,#10051f_0%,#1b0b34_48%,#310984_100%)] p-5 text-white shadow-2xl shadow-[#310984]/20 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/55">Hermes Planificación</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">Edificios</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72 md:text-base">
                Acceso operativo a los edificios/centros de trabajo: primero detecta qué falta configurar, luego entra en cada ficha para probar propuestas por edificio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="bg-[#f4d35e] text-[#171321] hover:bg-[#ffe17a]" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Añadir edificio
              </Button>
              <Button asChild className="bg-white text-[#310984] hover:bg-[#f0eaff]">
                <Link to="/planning?copilot=open">Volver a Hermes Planificación</Link>
              </Button>
              <Button type="button" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          if (isCreating) return;
          setIsCreateOpen(open);
          if (!open) {
            setCreateError('');
            setBuildingForm(initialBuildingForm);
          }
        }}>
          <DialogContent className="sm:max-w-lg">
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

        <Card className="border-[#310984]/10 bg-white shadow-lg shadow-[#310984]/6">
          <CardContent className="space-y-4 p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#171321]">Orden recomendado de trabajo</p>
                <p className="mt-1 text-xs leading-5 text-[#6b627a]">Configura primero los edificios incompletos. Los listos para probar ya pueden generar propuesta revisable desde su ficha.</p>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b627a]" />
                <Input
                  aria-label="Buscar edificio por nombre, código, zona o cliente"
                  className="h-11 border-[#310984]/12 pl-9"
                  placeholder="Buscar edificio, código o zona…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                <p className="text-xs text-[#6b627a]">Total edificios</p>
                <p className="text-2xl font-semibold text-[#171321]">{setupStats.total}</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-800">
                <p className="text-xs opacity-80">Configurar primero</p>
                <p className="text-2xl font-semibold">{setupStats.needsSetup}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sky-800">
                <p className="text-xs opacity-80">Listos para probar</p>
                <p className="text-2xl font-semibold">{setupStats.readyToTest}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                <p className="text-xs opacity-80">Configurados</p>
                <p className="text-2xl font-semibold">{setupStats.configured}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No se pudieron cargar los edificios</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : 'Revisa permisos, sede activa o conexión.'}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <Card className="border-[#310984]/10 bg-white shadow-sm">
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center text-[#6b627a]">
              <Building2 className="h-10 w-10 animate-pulse text-[#310984]" />
              <p className="font-semibold text-[#171321]">Cargando edificios…</p>
              <p className="text-sm">Hermes está leyendo grupos, propiedades y equipos operativos.</p>
            </CardContent>
          </Card>
        ) : propertyGroups.length === 0 ? (
          <Card className="border-[#310984]/10 bg-white shadow-sm">
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center text-[#6b627a]">
              <Home className="h-10 w-10 text-[#310984]" />
              <p className="font-semibold text-[#171321]">No hay edificios activos visibles</p>
              <p className="max-w-xl text-sm">Si deberían aparecer MD18 u otros centros, probablemente falta permiso de lectura sobre grupos o hay que revisar los datos activos.</p>
            </CardContent>
          </Card>
        ) : buildingCards.length === 0 ? (
          <Card className="border-[#310984]/10 bg-white shadow-sm">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center text-[#6b627a]">
              <Search className="h-10 w-10 text-[#310984]" />
              <p className="font-semibold text-[#171321]">No hay edificios con esa búsqueda</p>
              <p className="max-w-xl text-sm">Prueba por código, nombre, zona o cliente.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {buildingCards.map(({ group, propertyCount, teamCount, excludedCount, setup }) => (
              <Card key={group.id} className="group border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#310984]/10">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-[#310984]/15 bg-[#faf8ff] text-[#310984]">
                          {group.internalCode || group.name}
                        </Badge>
                        <Badge variant="outline" className={setup.className}>{setup.label}</Badge>
                      </div>
                      <CardTitle className="mt-3 break-words text-xl text-[#171321]">
                        {group.displayName || group.name}
                      </CardTitle>
                      {group.zone && <p className="mt-1 text-sm text-[#6b627a]">Zona: {group.zone}</p>}
                    </div>
                    <div className="rounded-2xl bg-[#310984]/10 p-3 text-[#310984]">
                      <Building2 className="h-5 w-5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3 text-sm text-[#6b627a]">{setup.helper}</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-2xl bg-[#faf8ff] p-3">
                      <p className="text-xs text-[#6b627a]">Propiedades</p>
                      <p className="text-lg font-semibold text-[#171321]">{propertyCount}</p>
                    </div>
                    <div className="rounded-2xl bg-[#faf8ff] p-3">
                      <p className="text-xs text-[#6b627a]">Equipo</p>
                      <p className="text-lg font-semibold text-[#171321]">{teamCount}</p>
                    </div>
                    <div className="rounded-2xl bg-[#faf8ff] p-3">
                      <p className="text-xs text-[#6b627a]">No aptas</p>
                      <p className="text-lg font-semibold text-[#171321]">{excludedCount}</p>
                    </div>
                  </div>
                  {group.planningNotes && (
                    <p className="line-clamp-2 rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3 text-sm text-[#6b627a]">{group.planningNotes}</p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="flex-1 bg-[#310984] text-white hover:bg-[#4c1bb0]">
                      <Link to={`/planning/buildings/${group.id}`}>
                        Personalizar edificio
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    {propertyCount === 0 && teamCount === 0 && excludedCount === 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            disabled={deletingGroupId === group.id}
                          >
                            {deletingGroupId === group.id
                              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              : <Trash2 className="mr-2 h-4 w-4" />}
                            Eliminar edificio vacío
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar {group.displayName || group.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Este edificio no tiene propiedades, equipo ni personas marcadas como No aptas. Se eliminará permanentemente y esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 text-white hover:bg-red-700"
                              onClick={() => void handleDeleteEmptyBuilding(group)}
                            >
                              Sí, eliminar edificio
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-[#310984]/10 bg-white shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 text-sm text-[#6b627a] md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 text-[#310984]" />
              <p>Esta entrada depende del permiso operativo de planificación, no del acceso antiguo a ajustes. La aplicación final sigue en Hermes Planificación.</p>
            </div>
            <Button asChild variant="outline" className="border-[#310984]/15 text-[#310984] hover:bg-[#f0eaff]">
              <Link to="/planning?copilot=open">Abrir Hermes Planificación</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlanningBuildingsIndex;
