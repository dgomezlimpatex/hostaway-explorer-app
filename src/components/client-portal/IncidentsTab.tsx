import { useEffect, useMemo, useState } from 'react';
import { format, isAfter, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Filter,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  usePortalIncidents,
  usePortalAddIncidentComment,
  usePortalUpdateIncident,
  PortalIncident,
  PortalIncidentStatus,
} from '@/hooks/usePortalIncidents';

const statusConfig: Record<PortalIncidentStatus, { label: string; className: string; dot: string }> = {
  open: {
    label: 'Nueva',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  in_progress: {
    label: 'En proceso',
    className: 'bg-sky-100 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
  },
  resolved: {
    label: 'Resuelta',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  discarded: {
    label: 'Descartada',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
};

const statusPriority: Record<PortalIncidentStatus, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
  discarded: 3,
};

interface Props {
  clientId: string;
}

type DateFilter = 'all' | '7d' | '30d' | '90d';
type PropertyGroup = {
  key: string;
  propertyId: string | null;
  propertyName: string;
  propertyCode: string | null;
  incidents: PortalIncident[];
  counts: Record<PortalIncidentStatus, number>;
};

const getPropertyKey = (incident: PortalIncident) => incident.property_id || 'without-property';

const getPropertyName = (incident: PortalIncident) => {
  return incident.property?.nombre || 'Sin propiedad asignada';
};

const getPropertyCode = (incident: PortalIncident) => {
  return incident.property?.codigo || null;
};

const matchesDateFilter = (incident: PortalIncident, filter: DateFilter) => {
  if (filter === 'all') return true;
  const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
  return isAfter(new Date(incident.created_at), subDays(new Date(), days));
};

const sortIncidents = (items: PortalIncident[]) => {
  return [...items].sort((a, b) => {
    const priority = statusPriority[a.status] - statusPriority[b.status];
    if (priority !== 0) return priority;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

const countByStatus = (items: PortalIncident[]) => {
  return items.reduce<Record<PortalIncidentStatus, number>>(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { open: 0, in_progress: 0, resolved: 0, discarded: 0 },
  );
};

export const IncidentsTab = ({ clientId }: Props) => {
  const { data: incidents = [], isLoading } = usePortalIncidents(clientId);
  const [selected, setSelected] = useState<PortalIncident | null>(null);
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PortalIncidentStatus | 'all'>('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const updateMutation = usePortalUpdateIncident();
  const commentMutation = usePortalAddIncidentComment();

  useEffect(() => {
    if (!selected) return;
    const refreshed = incidents.find((incident) => incident.id === selected.id);
    if (refreshed) setSelected(refreshed);
  }, [incidents, selected]);

  const metrics = useMemo(() => {
    const counts = countByStatus(incidents);
    return {
      total: incidents.length,
      open: counts.open,
      inProgress: counts.in_progress,
      resolved: counts.resolved,
      active: counts.open + counts.in_progress,
    };
  }, [incidents]);

  const propertyOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    incidents.forEach((incident) => {
      const key = getPropertyKey(incident);
      const code = getPropertyCode(incident);
      const label = code ? `${code} · ${getPropertyName(incident)}` : getPropertyName(incident);
      map.set(key, { key, label });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [incidents]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    incidents.forEach((incident) => {
      if (incident.category?.id) {
        map.set(incident.category.id, incident.category.label);
      }
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return sortIncidents(incidents).filter((incident) => {
      if (statusFilter !== 'all' && incident.status !== statusFilter) return false;
      if (propertyFilter !== 'all' && getPropertyKey(incident) !== propertyFilter) return false;
      if (categoryFilter !== 'all' && incident.category?.id !== categoryFilter) return false;
      if (!matchesDateFilter(incident, dateFilter)) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        incident.description,
        incident.location,
        incident.property?.nombre,
        incident.property?.codigo,
        incident.category?.label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [categoryFilter, dateFilter, incidents, propertyFilter, search, statusFilter]);

  const propertyGroups = useMemo<PropertyGroup[]>(() => {
    const groups = new Map<string, PropertyGroup>();

    filteredIncidents.forEach((incident) => {
      const key = getPropertyKey(incident);
      const current = groups.get(key) || {
        key,
        propertyId: incident.property_id,
        propertyName: getPropertyName(incident),
        propertyCode: getPropertyCode(incident),
        incidents: [],
        counts: { open: 0, in_progress: 0, resolved: 0, discarded: 0 },
      };

      current.incidents.push(incident);
      current.counts[incident.status] += 1;
      groups.set(key, current);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const activeA = a.counts.open + a.counts.in_progress;
      const activeB = b.counts.open + b.counts.in_progress;
      if (activeA !== activeB) return activeB - activeA;
      return a.propertyName.localeCompare(b.propertyName);
    });
  }, [filteredIncidents]);

  const hasFilters =
    search.trim() ||
    statusFilter !== 'all' ||
    propertyFilter !== 'all' ||
    categoryFilter !== 'all' ||
    dateFilter !== 'all';

  const handleAction = async (toStatus: 'resolved' | 'discarded' | 'in_progress') => {
    if (!selected) return;
    await updateMutation.mutateAsync({
      incidentId: selected.id,
      toStatus,
      note: note.trim() || undefined,
      clientId,
    });
    setSelected(null);
    setNote('');
  };

  const handleComment = async () => {
    if (!selected || !comment.trim()) return;
    await commentMutation.mutateAsync({
      incidentId: selected.id,
      body: comment,
      clientId,
    });
    setComment('');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPropertyFilter('all');
    setCategoryFilter('all');
    setDateFilter('all');
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Incidencias
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Seguimiento de incidencias publicadas por Limpatex, organizadas por propiedad.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="sm:hidden"
            onClick={() => setShowFilters((value) => !value)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Nuevas" value={metrics.open} tone="amber" />
          <MetricCard label="En proceso" value={metrics.inProgress} tone="sky" />
          <MetricCard label="Resueltas" value={metrics.resolved} tone="emerald" />
          <MetricCard label="Total" value={metrics.total} tone="slate" />
        </div>
      </div>

      <Card className={cn('p-3 sm:block', showFilters ? 'block' : 'hidden sm:block')}>
        <div className="grid gap-2 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar descripcion, zona o propiedad..."
              className="pl-9"
            />
          </div>

          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Propiedad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las propiedades</SelectItem>
              {propertyOptions.map((property) => (
                <SelectItem key={property.key} value={property.key}>
                  {property.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PortalIncidentStatus | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="open">Nueva</SelectItem>
              <SelectItem value="in_progress">En proceso</SelectItem>
              <SelectItem value="resolved">Resuelta</SelectItem>
              <SelectItem value="discarded">Descartada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorias</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Fecha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fechas</SelectItem>
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="90d">Ultimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters}>
            Limpiar
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Cargando incidencias...
        </Card>
      ) : incidents.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
          <p className="font-medium text-slate-900">No hay incidencias publicadas.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando Limpatex publique una incidencia, aparecera aqui organizada por propiedad.
          </p>
        </Card>
      ) : propertyGroups.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
          <p className="font-medium text-slate-900">No hay resultados con estos filtros.</p>
          <Button variant="link" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredIncidents.length} incidencia{filteredIncidents.length === 1 ? '' : 's'} en{' '}
              {propertyGroups.length} propiedad{propertyGroups.length === 1 ? '' : 'es'}
            </span>
            <span>{metrics.active} activas</span>
          </div>

          {propertyGroups.map((group) => (
            <PropertyIncidentGroup
              key={group.key}
              group={group}
              collapsed={collapsedGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
              onSelect={(incident) => {
                setSelected(incident);
                setNote('');
                setComment('');
              }}
            />
          ))}
        </div>
      )}

      <IncidentDetailSheet
        selected={selected}
        note={note}
        comment={comment}
        updatePending={updateMutation.isPending}
        commentPending={commentMutation.isPending}
        onClose={() => {
          setSelected(null);
          setComment('');
          setNote('');
        }}
        onNoteChange={setNote}
        onCommentChange={setComment}
        onComment={handleComment}
        onAction={handleAction}
      />
    </div>
  );
};

const MetricCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'sky' | 'emerald' | 'slate';
}) => {
  const styles = {
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };

  return (
    <div className={cn('rounded-xl border p-3', styles[tone])}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
};

const PropertyIncidentGroup = ({
  group,
  collapsed,
  onToggle,
  onSelect,
}: {
  group: PropertyGroup;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (incident: PortalIncident) => void;
}) => {
  const activeCount = group.counts.open + group.counts.in_progress;

  return (
    <Card className={cn('overflow-hidden', activeCount > 0 && 'border-amber-200 shadow-sm shadow-amber-100/70')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-white p-4 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            activeCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500',
          )}>
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {group.propertyCode && (
                <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {group.propertyCode}
                </span>
              )}
              <h3 className="truncate text-sm font-semibold text-slate-950 sm:text-base">{group.propertyName}</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {group.incidents.length} incidencia{group.incidents.length === 1 ? '' : 's'}
              {activeCount > 0 ? ` · ${activeCount} activa${activeCount === 1 ? '' : 's'}` : ' · sin activas'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusPill label="Nuevas" count={group.counts.open} status="open" />
          <StatusPill label="Proceso" count={group.counts.in_progress} status="in_progress" />
          <StatusPill label="Resueltas" count={group.counts.resolved} status="resolved" className="hidden sm:flex" />
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {!collapsed && (
        <div className="divide-y border-t bg-slate-50/60">
          {group.incidents.map((incident) => (
            <IncidentListItem key={incident.id} incident={incident} onSelect={() => onSelect(incident)} />
          ))}
        </div>
      )}
    </Card>
  );
};

const StatusPill = ({
  label,
  count,
  status,
  className,
}: {
  label: string;
  count: number;
  status: PortalIncidentStatus;
  className?: string;
}) => (
  <span className={cn(
    'flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium',
    statusConfig[status].className,
    count === 0 && 'opacity-40',
    className,
  )}>
    {count}
    <span className="hidden sm:inline">{label}</span>
  </span>
);

const IncidentListItem = ({ incident, onSelect }: { incident: PortalIncident; onSelect: () => void }) => {
  const cfg = statusConfig[incident.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-white sm:p-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
          <span className="font-semibold text-sm text-slate-950">{incident.category?.label ?? 'Incidencia'}</span>
          <Badge variant="outline" className={cfg.className}>
            {cfg.label}
          </Badge>
          {incident.media && incident.media.length > 0 && (
            <Badge variant="outline" className="gap-1 text-[11px]">
              <ImageIcon className="h-3 w-3" />
              {incident.media.length}
            </Badge>
          )}
          {incident.comments && incident.comments.length > 0 && (
            <Badge variant="outline" className="gap-1 text-[11px]">
              <MessageSquare className="h-3 w-3" />
              {incident.comments.length}
            </Badge>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {incident.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {incident.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(new Date(incident.created_at), "d MMM yyyy · HH:mm", { locale: es })}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-xs text-slate-700 sm:text-sm">{incident.description}</p>
      </div>

      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
};

const IncidentDetailSheet = ({
  selected,
  note,
  comment,
  updatePending,
  commentPending,
  onClose,
  onNoteChange,
  onCommentChange,
  onComment,
  onAction,
}: {
  selected: PortalIncident | null;
  note: string;
  comment: string;
  updatePending: boolean;
  commentPending: boolean;
  onClose: () => void;
  onNoteChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onComment: () => void;
  onAction: (toStatus: 'resolved' | 'discarded' | 'in_progress') => void;
}) => (
  <Sheet open={!!selected} onOpenChange={(open) => !open && onClose()}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
      {selected && (
        <>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 pr-8 text-left">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {selected.category?.label ?? 'Incidencia'}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={statusConfig[selected.status].className}>
                  {statusConfig[selected.status].label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(selected.created_at), "d 'de' MMM yyyy · HH:mm", { locale: es })}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Propiedad</div>
                  <div className="mt-1 text-sm font-medium text-slate-950">
                    {selected.property?.codigo ? `${selected.property.codigo} · ` : ''}
                    {selected.property?.nombre ?? 'Sin propiedad'}
                  </div>
                </div>
                {selected.location && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ubicacion</div>
                    <div className="mt-1 text-sm">{selected.location}</div>
                  </div>
                )}
              </div>
            </div>

            <section>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripcion</div>
              <p className="mt-2 whitespace-pre-wrap rounded-lg border bg-white p-3 text-sm">{selected.description}</p>
            </section>

            {selected.media && selected.media.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Evidencias
                  </div>
                  <Badge variant="outline">{selected.media.length} archivo{selected.media.length === 1 ? '' : 's'}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selected.media.map((media) => (
                    <a
                      key={media.id}
                      href={media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block aspect-square overflow-hidden rounded-xl border bg-muted"
                    >
                      {media.kind === 'video' ? (
                        <video src={media.url} className="h-full w-full object-cover" />
                      ) : (
                        <img src={media.url} alt="Evidencia" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                        Abrir evidencia
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {selected.resolution_note && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-semibold text-emerald-800">Resolucion</div>
                <p className="mt-1 text-sm text-emerald-950">{selected.resolution_note}</p>
              </div>
            )}

            {selected.client_discard_reason && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-700">Motivo de descarte</div>
                <p className="mt-1 text-sm text-slate-800">{selected.client_discard_reason}</p>
              </div>
            )}

            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Comentarios
              </div>

              {selected.comments && selected.comments.length > 0 ? (
                <div className="space-y-2">
                  {selected.comments.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-xl border p-3 text-sm',
                        item.author_kind === 'client'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-sky-200 bg-sky-50',
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{item.author_kind === 'client' ? 'Cliente' : 'Limpatex'}</span>
                        <span>{format(new Date(item.created_at), "d MMM yyyy · HH:mm", { locale: es })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{item.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                  No hay comentarios todavia.
                </p>
              )}

              <div className="space-y-2">
                <Textarea
                  value={comment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  placeholder="Escribe un comentario para Limpatex..."
                  rows={3}
                />
                <Button variant="outline" onClick={onComment} disabled={!comment.trim() || commentPending}>
                  {commentPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Enviar comentario
                </Button>
              </div>
            </section>

            {(selected.status === 'open' || selected.status === 'in_progress') && (
              <section className="space-y-3 border-t pt-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mensaje para Limpatex (opcional)
                  </label>
                  <Textarea
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value)}
                    placeholder="Añade contexto antes de cambiar el estado..."
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {selected.status === 'open' && (
                    <Button variant="outline" onClick={() => onAction('in_progress')} disabled={updatePending}>
                      <Clock className="mr-1 h-4 w-4" />
                      En proceso
                    </Button>
                  )}
                  <Button onClick={() => onAction('resolved')} disabled={updatePending} className="bg-emerald-600 hover:bg-emerald-700">
                    {updatePending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                    Resolver
                  </Button>
                  <Button variant="outline" onClick={() => onAction('discarded')} disabled={updatePending} className="text-rose-600 hover:text-rose-700">
                    <X className="mr-1 h-4 w-4" />
                    Descartar
                  </Button>
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </SheetContent>
  </Sheet>
);
