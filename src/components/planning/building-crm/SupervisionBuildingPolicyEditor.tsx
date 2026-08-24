import { useEffect, useState } from 'react';
import { CalendarClock, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSupervisionBuildingPolicy, useUpsertSupervisionBuildingPolicy, type SupervisionBuildingPolicy } from '@/hooks/useSupervisionBuildingPolicy';

interface SupervisionBuildingPolicyEditorProps { propertyGroupId: string }

export const SupervisionBuildingPolicyEditor = ({ propertyGroupId }: SupervisionBuildingPolicyEditorProps) => {
  const policyQuery = useSupervisionBuildingPolicy(propertyGroupId);
  const save = useUpsertSupervisionBuildingPolicy();
  const [policy, setPolicy] = useState<SupervisionBuildingPolicy>({ property_group_id: propertyGroupId, quick_review_every_days: 1, full_review_every_days: 7, full_review_requires_cleaning: false, review_open_incidents: true, review_returned_work: true, is_active: true });

  useEffect(() => { if (policyQuery.data) setPolicy(policyQuery.data); }, [policyQuery.data]);

  return <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base text-[#171321]"><CalendarClock className="h-5 w-5 text-[#310984]" />Programa de supervisión</CardTitle><p className="text-sm text-[#6b627a]">Define cada cuánto debe aparecer una comprobación de este edificio. La agenda se genera automáticamente.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Revisión rápida cada días<Input className="mt-1" type="number" min={1} max={31} value={policy.quick_review_every_days} onChange={(event) => setPolicy((current) => ({ ...current, quick_review_every_days: Number(event.target.value) }))} /></label><label className="text-sm font-medium">Revisión completa cada días<Input className="mt-1" type="number" min={1} max={90} value={policy.full_review_every_days} onChange={(event) => setPolicy((current) => ({ ...current, full_review_every_days: Number(event.target.value) }))} /></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.full_review_requires_cleaning} onChange={(event) => setPolicy((current) => ({ ...current, full_review_requires_cleaning: event.target.checked }))} />Solo generar revisión completa cuando haya una limpieza terminada</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.review_open_incidents} onChange={(event) => setPolicy((current) => ({ ...current, review_open_incidents: event.target.checked }))} />Priorizar propiedades con incidencias abiertas</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.review_returned_work} onChange={(event) => setPolicy((current) => ({ ...current, review_returned_work: event.target.checked }))} />Priorizar propiedades devueltas para repaso</label><div className="flex justify-end"><Button onClick={() => void save.mutateAsync(policy)} disabled={save.isPending || policyQuery.isLoading}><Save className="mr-2 h-4 w-4" />{save.isPending ? 'Guardando…' : 'Guardar programa'}</Button></div></CardContent></Card>;
};
