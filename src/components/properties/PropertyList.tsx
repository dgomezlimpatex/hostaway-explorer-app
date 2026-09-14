import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Clock, Users } from 'lucide-react';
import { Property } from '@/types/property';
import { cn } from '@/lib/utils';
import { propertyDuration } from './propertyPresentation';

interface PropertyListProps {
  properties: Property[];
  selectedPropertyId?: string;
  onSelect: (property: Property) => void;
  getClientName: (property: Property) => string;
  isActive: (property: Property) => boolean;
  expandMatches?: boolean;
}

const PropertyRows = ({ properties, selectedPropertyId, onSelect, isActive }: PropertyListProps) => (
  <div className="space-y-2">
    {properties.map(property => {
      const selected = property.id === selectedPropertyId;
      return (
        <button key={property.id} type="button" aria-pressed={selected} onClick={() => onSelect(property)} className={cn(
          'flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984] focus-visible:ring-offset-2',
          selected ? 'border-[#310984]/30 bg-violet-50 ring-1 ring-[#310984]/20' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50',
        )}>
          <span className={cn('flex min-h-10 w-10 shrink-0 items-center justify-center rounded-xl px-1 py-2 text-center text-[11px] font-black break-all', selected ? 'bg-white text-[#310984]' : 'bg-slate-100 text-slate-600')}>
            {property.codigo || '—'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-black leading-tight text-slate-950">{property.nombre}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={cn('rounded-full px-2 py-0.5 font-bold', isActive(property) ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600')}>{isActive(property) ? 'Activa' : 'Inactiva'}</span>
              <span className="flex items-center gap-1 text-slate-500"><Clock className="h-3 w-3" />{propertyDuration(property.duracionServicio)}</span>
            </span>
          </span>
          <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-slate-400" />
        </button>
      );
    })}
  </div>
);

export function PropertyList(props: PropertyListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const groups = new Map<string, { id: string; name: string; properties: Property[] }>();
  for (const property of props.properties) {
    const id = property.clienteId || 'unassigned';
    const group = groups.get(id) || { id, name: props.getClientName(property), properties: [] };
    group.properties.push(property);
    groups.set(id, group);
  }
  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (a.id === 'unassigned') return 1;
    if (b.id === 'unassigned') return -1;
    return a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });
  });
  const selectedGroup = sortedGroups.find(group => group.properties.some(property => property.id === props.selectedPropertyId));

  return (
    <div className="space-y-3">
      {sortedGroups.map((group, index) => {
        const containsSelected = group.id === selectedGroup?.id;
        const open = expanded[group.id] ?? (props.expandMatches || containsSelected || (!selectedGroup && index === 0));
        const activeCount = group.properties.filter(props.isActive).length;
        return (
          <Collapsible key={group.id} open={open} onOpenChange={value => setExpanded(current => ({ ...current, [group.id]: value }))} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <CollapsibleTrigger asChild>
              <button type="button" className={cn(
                'flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#310984]',
                containsSelected ? 'bg-violet-50/70' : 'bg-slate-50',
              )}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#310984]"><Users className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-black text-slate-950">{group.name}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">{group.properties.length} {group.properties.length === 1 ? 'propiedad' : 'propiedades'} · {activeCount} {activeCount === 1 ? 'activa' : 'activas'}</span>
                </span>
                <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform motion-reduce:transition-none', !open && '-rotate-90')} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-slate-100 p-2">
                <PropertyRows {...props} properties={group.properties} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
