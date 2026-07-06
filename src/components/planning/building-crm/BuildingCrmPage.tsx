import { useEffect, useState } from 'react';
import { AlertTriangle, Building2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AssignmentProposalResult } from '@/types/cleaningPlanning';
import type { PlanningBuildingCrmProfile } from '@/types/operationalPlanning';
import { buildBuildingCrmAssignmentProposal } from '@/services/planning/buildingCrmAggregator';
import { BuildingAssignmentProposalPanel } from './BuildingAssignmentProposalPanel';
import { BuildingCrmHeader } from './BuildingCrmHeader';
import { BuildingCrmKpis } from './BuildingCrmKpis';
import { BuildingDemandCalendar } from './BuildingDemandCalendar';
import { BuildingDecisionList } from './BuildingDecisionList';
import { BuildingTeamPanel } from './BuildingTeamPanel';
import { BuildingPropertiesPanel } from './BuildingPropertiesPanel';

interface BuildingCrmPageProps {
  propertyGroupId: string;
  dateFrom: string;
  dateTo: string;
  rangeDays: number;
  onRangeDaysChange: (days: number) => void;
  profile?: PlanningBuildingCrmProfile;
  isLoading: boolean;
  isError: boolean;
  error?: string | null;
  onRefresh: () => void;
}

const rangeOptions = [
  { days: 30, label: '30 días' },
  { days: 60, label: '60 días' },
  { days: 90, label: '90 días' },
];

export const BuildingCrmPage = ({
  propertyGroupId,
  dateFrom,
  dateTo,
  rangeDays,
  onRangeDaysChange,
  profile,
  isLoading,
  isError,
  error,
  onRefresh,
}: BuildingCrmPageProps) => {
  const [assignmentProposal, setAssignmentProposal] = useState<AssignmentProposalResult | null>(null);

  useEffect(() => {
    setAssignmentProposal(null);
  }, [profile?.building.id, dateFrom, dateTo]);

  const handleGenerateAssignmentProposal = () => {
    if (!profile) return;
    setAssignmentProposal(buildBuildingCrmAssignmentProposal(profile));
  };

  return (
    <div className="min-h-screen bg-[#f7f4fb] px-4 py-5 text-[#171321] md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#310984]/65">Ficha operativa del edificio</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171321] md:text-3xl">
              Planificación y previsión por centro
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[#6b627a]">
              Vista tipo CRM para entender carga, equipo, propiedades y decisiones futuras de un edificio sin entrar en tablas técnicas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rangeOptions.map((option) => (
              <Button
                key={option.days}
                type="button"
                variant={rangeDays === option.days ? 'default' : 'outline'}
                className={rangeDays === option.days ? 'bg-[#310984] text-white hover:bg-[#4c1bb0]' : 'border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff]'}
                onClick={() => onRangeDaysChange(option.days)}
              >
                {option.label}
              </Button>
            ))}
            <Button type="button" variant="outline" className="border-[#310984]/15 bg-white" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No se pudo cargar la ficha del edificio</AlertTitle>
            <AlertDescription>{error || 'Revisa conexión, permisos o sede activa.'}</AlertDescription>
          </Alert>
        )}

        {isLoading && !profile && (
          <Card className="border-[#310984]/10 bg-white shadow-sm">
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center text-[#6b627a]">
              <div className="rounded-3xl bg-[#310984]/10 p-4 text-[#310984]">
                <Building2 className="h-8 w-8 animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-[#171321]">Cargando CRM del edificio…</p>
                <p className="text-sm">Estamos calculando calendario, horas, equipo y decisiones del rango {dateFrom}–{dateTo}.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !profile && !isError && (
          <Card className="border-[#310984]/10 bg-white shadow-sm">
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center text-[#6b627a]">
              <Building2 className="h-10 w-10 text-[#310984]" />
              <div>
                <p className="font-semibold text-[#171321]">Selecciona un edificio válido</p>
                <p className="text-sm">No hay datos para el centro solicitado: {propertyGroupId || 'sin id'}.</p>
              </div>
              <Button asChild className="bg-[#310984] text-white hover:bg-[#4c1bb0]">
                <Link to="/planning/buildings">Volver a edificios</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {profile && (
          <>
            <BuildingCrmHeader profile={profile} />
            <BuildingCrmKpis summary={profile.summary} rangeDays={rangeDays} />
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-5">
                <BuildingAssignmentProposalPanel
                  profile={profile}
                  proposal={assignmentProposal}
                  onGenerate={handleGenerateAssignmentProposal}
                  onClear={() => setAssignmentProposal(null)}
                />
                <BuildingDemandCalendar days={profile.days} />
                <BuildingPropertiesPanel properties={profile.properties} />
              </div>
              <aside className="space-y-5">
                <BuildingDecisionList decisions={profile.decisions} />
                <BuildingTeamPanel team={profile.team} />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
