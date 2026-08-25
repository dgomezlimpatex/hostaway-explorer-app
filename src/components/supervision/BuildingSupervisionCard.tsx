import { AlertTriangle, Building2, CalendarClock, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, Home, LockKeyhole, Package } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BuildingAgendaBuildingResult, BuildingAgendaItem, BuildingAgendaProperty } from '@/features/supervision/buildingAgenda';
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

const formatCivilDate = (date?: string | null): string => date ? date.split('-').reverse().join('/') : '';

const occupancyLabel = (property: BuildingAgendaProperty): string => {
  const occupancy = property.occupancy;
  if (!occupancy || occupancy.status === 'unknown') return 'No se pudo comprobar la ocupación';
  if (occupancy.status === 'occupied') {
    return occupancy.currentCheckOutDate
      ? `Ocupado · salida prevista ${formatCivilDate(occupancy.currentCheckOutDate)} ${occupancy.currentCheckOutTime || ''}`.trim()
      : 'Ocupado · revisión bloqueada';
  }
  return occupancy.nextCheckInDate
    ? `Vacío · próxima entrada ${formatCivilDate(occupancy.nextCheckInDate)} ${occupancy.nextCheckInTime || ''}`.trim()
    : 'Vacío · sin próxima entrada registrada';
};

export const BuildingSupervisionCard = ({ building, onReview, onDefer, onStockCheck, stockLevels, isPreparing }: BuildingSupervisionCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const pending = building.items.filter((item) => !['completed', 'cancelled'].includes(item.status));
  const completed = building.items.filter((item) => item.status === 'completed');
  const itemByPropertyId = new Map(building.items.map((item) => [item.propertyId, item]));

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#310984]/10 p-3 text-[#310984]"><Building2 className="h-6 w-6" /></div>
            <div>
              <CardTitle className="text-lg text-slate-950">{building.displayName || building.name}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">{building.properties.length} propiedades · {pending.length} comprobaciones pendientes</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800"><Clock3 className="mr-1 h-3.5 w-3.5" />{pending.length} pendientes</Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{completed.length} hechas</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Apartamentos del edificio</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onStockCheck} disabled={stockLevels.length === 0}><Package className="mr-1 h-4 w-4" />{stockLevels.length ? 'Revisar stock' : 'Sin trastero'}</Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Ocultar' : 'Mostrar'} <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></Button>
          </div>
        </div>
        {expanded && <div className="divide-y divide-slate-100">
          {building.properties.length === 0 && <div className="flex items-center gap-3 p-5 text-sm text-slate-500"><Home className="h-5 w-5 text-slate-400" />Este edificio todavía no tiene apartamentos vinculados.</div>}
          {building.properties.map((property) => {
            const item = itemByPropertyId.get(property.id);
            const occupancy = property.occupancy?.status || 'unknown';
            const occupied = occupancy === 'occupied';
            const unknown = occupancy === 'unknown';
            const rowClass = occupied ? 'border-l-4 border-red-500 bg-red-50/80' : unknown ? 'border-l-4 border-amber-400 bg-amber-50/70' : 'border-l-4 border-emerald-400 bg-emerald-50/40';
            return <div key={property.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${rowClass}`}>
              <div className="flex min-w-0 items-start gap-3">
                <div className={`mt-0.5 rounded-xl p-2 ${occupied ? 'bg-red-100 text-red-700' : unknown ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {occupied ? <LockKeyhole className="h-4 w-4" /> : unknown ? <AlertTriangle className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-950">{property.code ? `${property.code} · ` : ''}{property.name}</p>{item && <Badge variant="outline">{typeLabel[item.type]}</Badge>}</div>
                  <p className={`mt-1 text-xs ${occupied ? 'font-semibold text-red-800' : unknown ? 'font-semibold text-amber-800' : 'text-emerald-800'}`}>{occupancyLabel(property)}</p>
                  {occupancy === 'vacant' && item?.reasons.length ? <p className="mt-1 text-xs text-slate-500">{item.reasons.join(' · ')}</p> : null}
                </div>
              </div>
              {occupied ? <Badge variant="outline" className="w-fit border-red-300 bg-white text-red-800">Ocupado · no revisar</Badge> : unknown ? <Badge variant="outline" className="w-fit border-amber-300 bg-white text-amber-800">Revisión bloqueada</Badge> : item?.status === 'completed' ? <Badge variant="outline" className="w-fit border-emerald-200 bg-white text-emerald-800">Completada</Badge> : item?.status === 'blocked' ? <Badge variant="outline" className="w-fit border-red-200 bg-white text-red-800">Bloqueada</Badge> : item ? <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => onReview(item)} disabled={isPreparing}>{isPreparing ? 'Preparando…' : item.status === 'deferred' ? 'Retomar' : 'Revisar'}</Button><Button size="sm" variant="outline" onClick={() => onDefer(item)} disabled={isPreparing}>Aplazar</Button></div> : <Badge variant="outline" className="w-fit border-slate-200 bg-white text-slate-600"><CalendarClock className="mr-1 h-3.5 w-3.5" />Sin revisión pendiente</Badge>}
            </div>;
          })}
        </div>}
      </CardContent>
    </Card>
  );
};
