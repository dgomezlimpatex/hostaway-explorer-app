import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanningBuildingCrmDecision } from '@/types/operationalPlanning';

interface BuildingDecisionListProps {
  decisions: PlanningBuildingCrmDecision[];
}

const severityMeta: Record<PlanningBuildingCrmDecision['severity'], { label: string; className: string; icon: typeof AlertCircle }> = {
  critical: { label: 'Crítico', className: 'border-red-200 bg-red-50 text-red-800', icon: AlertCircle },
  warning: { label: 'Vigilar', className: 'border-amber-200 bg-amber-50 text-amber-800', icon: AlertTriangle },
  info: { label: 'Info', className: 'border-slate-200 bg-slate-50 text-slate-700', icon: CheckCircle2 },
};

const actionHref = (decision: PlanningBuildingCrmDecision) => {
  if (decision.actionTarget === 'planning') return decision.date ? `/planning?date=${decision.date}&copilot=open` : '/planning?copilot=open';
  if (decision.actionTarget === 'property') return decision.propertyId ? `/properties?propertyId=${decision.propertyId}` : '/properties';
  if (decision.actionTarget === 'team') return '/planning-settings';
  return '/planning-settings';
};

export const BuildingDecisionList = ({ decisions }: BuildingDecisionListProps) => {
  const sorted = [...decisions].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity] || (a.date || '').localeCompare(b.date || '');
  });

  return (
    <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-[#171321]">Decisiones del edificio</CardTitle>
            <p className="mt-1 text-sm text-[#6b627a]">Alertas tipo Sentry: solo lo que necesita acción o revisión.</p>
          </div>
          <Badge variant="outline" className="border-[#310984]/15 bg-[#faf8ff] text-[#310984]">{decisions.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Sin decisiones abiertas para este edificio en el rango seleccionado.
          </div>
        ) : (
          sorted.map((decision) => {
            const meta = severityMeta[decision.severity];
            const Icon = meta.icon;
            return (
              <article key={decision.id} className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl border p-2 ${meta.className}`}><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                      <Badge variant="outline" className="border-[#310984]/10 bg-white text-[#6b627a]">{decision.category}</Badge>
                      {decision.date && <span className="text-xs text-[#6b627a]">{decision.date}</span>}
                    </div>
                    <h3 className="mt-2 font-semibold text-[#171321]">{decision.title}</h3>
                    <p className="mt-1 text-sm text-[#6b627a]">{decision.message}</p>
                    <Button asChild size="sm" variant="outline" className="mt-3 border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff]">
                      <Link to={actionHref(decision)}>{decision.actionLabel}</Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
