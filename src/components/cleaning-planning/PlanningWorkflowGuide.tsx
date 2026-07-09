import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Filter, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PlanningWorkflowGuideProps {
  visibleTasksCount: number | string;
  plannedHoursLabel: string;
  capacityHoursLabel: string;
  buildingIssueCount: number | string;
  hasProposal: boolean;
}

const stepClass = 'rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-4';

export const PlanningWorkflowGuide = ({
  visibleTasksCount,
  plannedHoursLabel,
  capacityHoursLabel,
  buildingIssueCount,
  hasProposal,
}: PlanningWorkflowGuideProps) => (
  <Card className="border-[#310984]/10 bg-white text-[#171321] shadow-lg shadow-[#310984]/6">
    <CardContent className="space-y-4 p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#310984]/70">Cómo se usa esta pantalla</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#171321]">Cierra el plan en 3 pasos</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b627a]">
            Primero acota el día, después revisa si el edificio está personalizado y por último deja que Hermes prepare el reparto para confirmar.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984] lg:w-auto">
          <Link to="/planning/buildings">
            Personalizar edificios
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className={stepClass}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#310984]/10 p-2 text-[#310984]"><Filter className="h-4 w-4" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#171321]">1. Revisa la vista</p>
                <Badge variant="outline" className="border-[#310984]/15 bg-white text-[#310984]">{visibleTasksCount} tareas</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#6b627a]">Trabajas sobre sede, fecha y horizonte visibles. Carga: {plannedHoursLabel} / {capacityHoursLabel}.</p>
            </div>
          </div>
        </div>

        <div className={stepClass}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#310984]/10 p-2 text-[#310984]"><Building2 className="h-4 w-4" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#171321]">2. Personaliza edificios</p>
                <Badge variant="outline" className={Number(buildingIssueCount) > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                  {buildingIssueCount} a revisar
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#6b627a]">Define propiedades, duración, titulares, suplentes, backups y “No apta” por edificio antes de automatizar.</p>
            </div>
          </div>
        </div>

        <div className={stepClass}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#310984]/10 p-2 text-[#310984]"><Sparkles className="h-4 w-4" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#171321]">3. Planifica con Hermes</p>
                <Badge variant="outline" className={hasProposal ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#310984]/15 bg-white text-[#310984]'}>
                  {hasProposal ? 'Plan preparado' : 'Pendiente'}
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#6b627a]">Hermes propone; tú revisas, confirmas y notificas solo cuando el reparto sea correcto.</p>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);
