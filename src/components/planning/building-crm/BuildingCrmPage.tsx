import { AlertTriangle, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCleaners } from '@/hooks/useCleaners';
import type { PlanningBuildingCrmProfile } from '@/types/operationalPlanning';
import { BuildingCrmHeader } from './BuildingCrmHeader';
import { BuildingTeamEditor } from './BuildingTeamEditor';
import { BuildingPropertiesPanel } from './BuildingPropertiesPanel';
import { BuildingDataEditor } from './BuildingDataEditor';

interface BuildingCrmPageProps {
  propertyGroupId: string;
  profile?: PlanningBuildingCrmProfile;
  isLoading: boolean;
  isError: boolean;
  error?: string | null;
  onRefresh: () => void;
}

export const BuildingCrmPage = ({
  propertyGroupId,
  profile,
  isLoading,
  isError,
  error,
  onRefresh,
}: BuildingCrmPageProps) => {
  const { cleaners, isLoading: isLoadingCleaners } = useCleaners();

  return (
    <div className="min-h-screen bg-[#f7f4fb] px-3 py-4 text-[#171321] sm:px-4 md:px-6 md:py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-5">
        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No se pudo cargar el edificio</AlertTitle>
            <AlertDescription>{error || 'Revisa la conexión, los permisos o la sede activa.'}</AlertDescription>
          </Alert>
        )}

        {isLoading && !profile && (
          <Card className="border-[#310984]/10 bg-white shadow-sm">
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center text-[#6b627a]">
              <div className="rounded-2xl bg-[#310984]/10 p-4 text-[#310984]">
                <Building2 className="h-8 w-8 animate-pulse" />
              </div>
              <p className="font-semibold text-[#171321]">Cargando edificio…</p>
              <p className="text-sm">Estamos preparando sus datos, personal y propiedades.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !profile && !isError && (
          <Card className="border-[#310984]/10 bg-white shadow-sm">
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center text-[#6b627a]">
              <Building2 className="h-10 w-10 text-[#310984]" />
              <p className="font-semibold text-[#171321]">No encontramos este edificio</p>
              <p className="text-sm">No hay datos para el identificador {propertyGroupId || 'solicitado'}.</p>
              <Button asChild className="bg-[#310984] text-white hover:bg-[#4c1bb0]">
                <Link to="/planning/buildings">Volver a edificios</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {profile && (
          <>
            <BuildingCrmHeader profile={profile} onRefresh={onRefresh} isRefreshing={isLoading} />
            <main className="space-y-4 md:space-y-5">
              <section data-building-main-block="data" aria-label="Datos del edificio">
                <BuildingDataEditor profile={profile} onSaved={onRefresh} />
              </section>
              <section data-building-main-block="team" aria-label="Personal asignado">
                <BuildingTeamEditor
                  profile={profile}
                  allCleaners={cleaners}
                  isLoadingCleaners={isLoadingCleaners}
                  onSaved={onRefresh}
                />
              </section>
              <section data-building-main-block="properties" aria-label="Propiedades del edificio">
                <BuildingPropertiesPanel properties={profile.properties} />
              </section>
            </main>
          </>
        )}
      </div>
    </div>
  );
};
