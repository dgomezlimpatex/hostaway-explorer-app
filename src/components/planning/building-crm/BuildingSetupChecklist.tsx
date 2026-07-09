import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Home, Sparkles, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AssignmentProposalResult } from '@/types/cleaningPlanning';
import type { PlanningBuildingCrmProfile } from '@/types/operationalPlanning';
import { formatCrmHours } from './buildingCrmFormatters';

interface BuildingSetupChecklistProps {
  profile: PlanningBuildingCrmProfile;
  proposal: AssignmentProposalResult | null;
  onGenerateProposal: () => void;
}

const stepBaseClass = 'rounded-2xl border p-4';
const okClass = 'border-emerald-200 bg-emerald-50 text-emerald-800';
const warnClass = 'border-amber-200 bg-amber-50 text-amber-900';
const criticalClass = 'border-red-200 bg-red-50 text-red-900';

const getAllConfirmedPendingTasks = (profile: PlanningBuildingCrmProfile) => profile.days
  .flatMap((day) => day.tasks)
  .filter((task) => task.isConfirmed)
  .filter((task) => task.assignedCleanerIds.length < task.requiredCleaners);

export const BuildingSetupChecklist = ({ profile, proposal, onGenerateProposal }: BuildingSetupChecklistProps) => {
  const buildingName = profile.building.displayName || profile.building.name;
  const pendingTasks = getAllConfirmedPendingTasks(profile);
  const missingDurationProperties = profile.properties.filter((property) => property.hasMissingDuration);
  const activeTeam = profile.team.filter((member) => member.isActive && member.roleType !== 'excluded');
  const primaryCount = activeTeam.filter((member) => member.roleType === 'primary').length;
  const secondaryCount = activeTeam.filter((member) => member.roleType === 'secondary').length;
  const backupCount = activeTeam.filter((member) => member.roleType === 'backup').length;
  const teamGap = Math.max(0, profile.summary.recommendedStableStaff - activeTeam.length);
  const firstMissingProperty = missingDurationProperties[0];
  const proposedCount = proposal?.summary.proposedCount ?? 0;
  const conflictCount = proposal?.conflicts.length ?? 0;

  const propertyStepClass = missingDurationProperties.length > 0 ? criticalClass : okClass;
  const teamStepClass = activeTeam.length === 0 ? criticalClass : teamGap > 0 ? warnClass : okClass;
  const proposalStepClass = !proposal
    ? pendingTasks.length > 0 ? warnClass : okClass
    : conflictCount > 0 ? warnClass : okClass;

  return (
    <Card className="border-[#310984]/10 bg-white text-[#171321] shadow-lg shadow-[#310984]/6">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#310984]/70">Personalización del edificio</p>
            <CardTitle className="mt-1 text-xl tracking-tight">Deja {buildingName} listo para automatizar</CardTitle>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b627a]">
              Esta ficha debe responder tres cosas: qué propiedades tiene, qué equipo puede hacerlas y si Hermes ya puede proponer un reparto revisable.
            </p>
          </div>
          <Button type="button" className="w-full bg-[#310984] text-white hover:bg-[#4c1bb0] lg:w-auto" onClick={onGenerateProposal}>
            <Sparkles className="mr-2 h-4 w-4" /> Probar propuesta del edificio
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 lg:grid-cols-3">
        <section className={`${stepBaseClass} ${propertyStepClass}`}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white/70 p-2"><Home className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">1. Propiedades y duración</h3>
                <Badge variant="outline" className="border-current/20 bg-white/70 text-current">{profile.properties.length}</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 opacity-85">
                {missingDurationProperties.length > 0
                  ? `${missingDurationProperties.length} propiedad${missingDurationProperties.length === 1 ? '' : 'es'} sin duración. Hermes no debe inventar horas.`
                  : `Todas tienen duración operativa. Carga total: ${formatCrmHours(profile.summary.serviceMinutes)}.`}
              </p>
              {firstMissingProperty && (
                <Button asChild size="sm" variant="outline" className="mt-3 border-current/25 bg-white/75 text-current hover:bg-white">
                  <Link to={`/properties?propertyId=${firstMissingProperty.propertyId}`}>
                    Editar duración pendiente <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className={`${stepBaseClass} ${teamStepClass}`}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white/70 p-2"><Users className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">2. Equipo habitual</h3>
                <Badge variant="outline" className="border-current/20 bg-white/70 text-current">{activeTeam.length}/{profile.summary.recommendedStableStaff}</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 opacity-85">
                {activeTeam.length === 0
                  ? 'Faltan titulares/suplentes/backups activos para proponer asignaciones.'
                  : teamGap > 0
                    ? `Faltan ${teamGap} persona${teamGap === 1 ? '' : 's'} para llegar al personal recomendado.`
                    : `Equipo suficiente: ${primaryCount} titular${primaryCount === 1 ? '' : 'es'}, ${secondaryCount} suplente${secondaryCount === 1 ? '' : 's'} y ${backupCount} backup${backupCount === 1 ? '' : 's'}.`}
              </p>
              <p className="mt-2 text-[11px] opacity-75">No aptas registradas: {profile.summary.excludedCount}. No entran en propuestas.</p>
              <Button asChild size="sm" variant="outline" className="mt-3 border-current/25 bg-white/75 text-current hover:bg-white">
                <Link to="/planning-settings">
                  Editar equipo / No aptas <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className={`${stepBaseClass} ${proposalStepClass}`}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white/70 p-2"><CheckCircle2 className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">3. Propuesta revisable</h3>
                <Badge variant="outline" className="border-current/20 bg-white/70 text-current">{pendingTasks.length} pendientes</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 opacity-85">
                {!proposal
                  ? pendingTasks.length > 0
                    ? 'Prueba una propuesta aquí sin guardar cambios y aplica luego desde Hermes Planificación.'
                    : 'No hay limpiezas confirmadas pendientes de asignar en este rango.'
                  : conflictCount > 0
                    ? `${proposedCount} listas y ${conflictCount} necesitan decisión manual.`
                    : `${proposedCount} limpieza${proposedCount === 1 ? '' : 's'} lista${proposedCount === 1 ? '' : 's'} para revisar en el plan diario.`}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 border-current/25 bg-white/75 text-current hover:bg-white">
                <Link to="/planning?copilot=open">
                  Ver en planificación <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
};
