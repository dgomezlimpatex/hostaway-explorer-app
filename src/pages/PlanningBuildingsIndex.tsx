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
        <header className="rounded-3xl border border-[#310984]/10 bg-white p-4 shadow-sm sm:p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#171321]">Edificios</h1>
              <p className="mt-1 text-sm text-[#6b627a]">Consulta y gestiona cada centro desde una sola ficha.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" className="min-h-11 flex-1 bg-[#310984] text-white hover:bg-[#4c1bb0] sm:flex-none" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Añadir edificio
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 border-[#310984]/15" onClick={() => refetch()} disabled={isFetching} aria-label="Actualizar edificios">
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </header>

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

        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b627a]" />
          <Input
            aria-label="Buscar edificio por nombre, código, zona o cliente"
            className="h-11 border-[#310984]/12 bg-white pl-9 shadow-sm"
            placeholder="Buscar edificio, código o zona…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

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
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-[#faf8ff] p-3">
                      <p className="text-xs text-[#6b627a]">Propiedades</p>
                      <p className="text-lg font-semibold text-[#171321]">{propertyCount}</p>
                    </div>
                    <div className="rounded-2xl bg-[#faf8ff] p-3">
                      <p className="text-xs text-[#6b627a]">Personal</p>
                      <p className="text-lg font-semibold text-[#171321]">{teamCount}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="min-h-11 flex-1 bg-[#310984] text-white hover:bg-[#4c1bb0]">
                      <Link to={`/planning/buildings/${group.id}`}>
                        Ver edificio
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    {propertyCount === 0 && teamCount === 0 && excludedCount === 0 && (
                      <details className="rounded-xl border border-[#310984]/10 px-3 py-2 text-sm">
                        <summary className="cursor-pointer list-none text-center font-medium text-[#6b627a] hover:text-[#310984]">Acciones</summary>
                        <div className="mt-2">
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
                        </div>
                      </details>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default PlanningBuildingsIndex;
