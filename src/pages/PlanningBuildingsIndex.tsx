import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, Home, RefreshCw, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCleaningPlanningBuildingData } from '@/hooks/useCleaningPlanningBuildingData';

const PlanningBuildingsIndex = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useCleaningPlanningBuildingData();
  const propertyGroups = data?.propertyGroups || [];
  const propertyAssignments = data?.propertyAssignments || [];
  const cleanerAssignments = data?.cleanerAssignments || [];

  return (
    <div className="min-h-screen bg-[#f7f4fb] px-4 py-5 text-[#171321] md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(244,211,94,0.20),_transparent_34%),linear-gradient(135deg,#10051f_0%,#1b0b34_48%,#310984_100%)] p-5 text-white shadow-2xl shadow-[#310984]/20 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/55">Hermes Planificación</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">Edificios</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72 md:text-base">
                Acceso operativo a los edificios/centros de trabajo: carga futura, equipo asignado, propiedades vinculadas y decisiones pendientes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {propertyGroups.map((group) => {
              const propertyCount = propertyAssignments.filter((assignment) => assignment.propertyGroupId === group.id).length;
              const teamCount = cleanerAssignments.filter((assignment) => assignment.propertyGroupId === group.id && assignment.roleType !== 'excluded').length;
              const excludedCount = cleanerAssignments.filter((assignment) => assignment.propertyGroupId === group.id && assignment.roleType === 'excluded').length;
              return (
                <Card key={group.id} className="group border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#310984]/10">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Badge variant="outline" className="border-[#310984]/15 bg-[#faf8ff] text-[#310984]">
                          {group.internalCode || group.name}
                        </Badge>
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
                    <Button asChild className="w-full bg-[#310984] text-white hover:bg-[#4c1bb0]">
                      <Link to={`/planning/buildings/${group.id}`}>
                        Ver ficha edificio
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="border-[#310984]/10 bg-white shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 text-sm text-[#6b627a] md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-4 w-4 text-[#310984]" />
              <p>Esta entrada depende del permiso operativo de planificación, no del acceso antiguo a ajustes.</p>
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
