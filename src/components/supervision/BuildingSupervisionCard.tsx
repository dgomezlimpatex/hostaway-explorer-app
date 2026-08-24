import { AlertTriangle, Building2, CheckCircle2, ClipboardCheck, ChevronDown, Clock3, Home, Package } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BuildingAgendaBuildingResult, BuildingAgendaItem } from '@/features/supervision/buildingAgenda';
import type { BuildingStockLevel } from '@/features/supervision/buildingSupervisionStorage';

interface BuildingSupervisionCardProps {
  building: BuildingAgendaBuildingResult;
  onReview: (item: BuildingAgendaItem) => void;
  onDefer: (item: BuildingAgendaItem) => void;
  onStockCheck: () => void;
  stockLevels: BuildingStockLevel[];
  isPreparing: boolean;
}

const typeLabel: Record<BuildingAgendaItem['type'], string> = {
  quick: 'Revisión rápida',
  full: 'Revisión completa',
  rework: 'Repaso pendiente',
  incident: 'Incidencia',
};

export const BuildingSupervisionCard = ({ building, onReview, onDefer, onStockCheck, stockLevels, isPreparing }: BuildingSupervisionCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const pending = building.items.filter((item) => !['completed', 'cancelled'].includes(item.status));
  const completed = building.items.filter((item) => item.status === 'completed');

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#310984]/10 p-3 text-[#310984]"><Building2 className="h-6 w-6" /></div>
            <div>
              <CardTitle className="text-lg text-slate-950">{building.displayName || building.name}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">{building.properties.length} propiedades vinculadas · {pending.length} comprobaciones pendientes</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800"><Clock3 className="mr-1 h-3.5 w-3.5" />{pending.length} pendientes</Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{completed.length} hechas</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Comprobaciones de hoy</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={onStockCheck} disabled={stockLevels.length === 0}><Package className="mr-1 h-4 w-4" />{stockLevels.length ? 'Revisar stock' : 'Sin trastero'}</Button><Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Ocultar' : 'Mostrar'} <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></Button></div></div>
        {expanded && <div className="divide-y divide-slate-100">
          {building.items.length === 0 && <div className="flex items-center gap-3 p-5 text-sm text-slate-500"><Home className="h-5 w-5 text-slate-400" />No hay comprobaciones automáticas pendientes para este edificio hoy.</div>}
          {building.items.map((item) => (
            <div key={item.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`mt-0.5 rounded-xl p-2 ${item.type === 'incident' || item.type === 'rework' ? 'bg-red-50 text-red-700' : item.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-[#310984]'}`}>
                  {item.type === 'incident' || item.type === 'rework' ? <AlertTriangle className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-950">{item.propertyCode ? `${item.propertyCode} · ` : ''}{item.propertyName}</p><Badge variant="outline">{typeLabel[item.type]}</Badge></div>
                  <p className="mt-1 text-xs text-slate-500">{item.reasons.join(' · ')}</p>
                </div>
              </div>
              {item.status === 'completed' ? <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800">Completada</Badge> : item.status === 'blocked' ? <Badge variant="outline" className="w-fit border-red-200 bg-red-50 text-red-800">Bloqueada</Badge> : <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => onReview(item)} disabled={isPreparing}>{isPreparing ? 'Preparando…' : item.status === 'deferred' ? 'Retomar' : 'Revisar'}</Button><Button size="sm" variant="outline" onClick={() => onDefer(item)} disabled={isPreparing}>Aplazar</Button></div>}
            </div>
          ))}
        </div>}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500"><span>Edificio agrupado automáticamente</span><span>·</span><span>Las propiedades proceden de la configuración del edificio</span></div>
      </CardContent>
    </Card>
  );
};
