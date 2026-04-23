import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, CalendarPlus, Pencil, CalendarX, Search, History,
  User as UserIcon, Shield, Cog, Home as HomeIcon, ArrowRight, Clock,
} from 'lucide-react';
import {
  useClientReservationHistory,
  ClientReservationHistoryEntry,
} from '@/hooks/useClientPortal';

interface ClientReservationHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  clientName: string | null;
}

type ActionFilter = 'all' | 'created' | 'updated' | 'cancelled';
type ActorFilter = 'all' | 'client' | 'internal' | 'system';

const actionMeta: Record<string, { label: string; icon: typeof CalendarPlus; className: string }> = {
  created: {
    label: 'Reserva añadida',
    icon: CalendarPlus,
    className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  },
  updated: {
    label: 'Reserva editada',
    icon: Pencil,
    className: 'bg-blue-500/15 text-blue-700 border-blue-200',
  },
  cancelled: {
    label: 'Reserva cancelada',
    icon: CalendarX,
    className: 'bg-rose-500/15 text-rose-700 border-rose-200',
  },
};

const actorMeta: Record<string, { label: string; icon: typeof UserIcon; className: string }> = {
  client: {
    label: 'Cliente (portal)',
    icon: UserIcon,
    className: 'bg-amber-500/15 text-amber-700 border-amber-200',
  },
  admin: {
    label: 'Administrador',
    icon: Shield,
    className: 'bg-violet-500/15 text-violet-700 border-violet-200',
  },
  manager: {
    label: 'Manager',
    icon: Shield,
    className: 'bg-violet-500/15 text-violet-700 border-violet-200',
  },
  system: {
    label: 'Sistema',
    icon: Cog,
    className: 'bg-slate-500/15 text-slate-700 border-slate-200',
  },
};

const formatDateValue = (value: unknown): string => {
  if (!value || typeof value !== 'string') return '—';
  // Acepta fechas ISO (YYYY-MM-DD) y timestamps.
  try {
    const d = value.length === 10 ? new Date(value + 'T00:00:00') : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return format(d, "d 'de' MMMM yyyy", { locale: es });
  } catch {
    return String(value);
  }
};

const diffField = (
  label: string,
  before: unknown,
  after: unknown,
  isDate = false,
): React.ReactNode | null => {
  const a = before ?? null;
  const b = after ?? null;
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  const fmt = (v: unknown) => {
    if (v === null || v === undefined || v === '') return '—';
    if (isDate) return formatDateValue(v);
    return String(v);
  };
  return (
    <div key={label} className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-muted-foreground min-w-[110px]">{label}</span>
      <span className="line-through text-rose-600">{fmt(a)}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="text-emerald-700 font-medium">{fmt(b)}</span>
    </div>
  );
};

const renderEntryDetails = (entry: ClientReservationHistoryEntry): React.ReactNode => {
  const oldD = entry.oldData ?? {};
  const newD = entry.newData ?? {};

  if (entry.action === 'created') {
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>📅 Check-in: <span className="font-medium text-foreground">{formatDateValue(newD.checkInDate)}</span></div>
        <div>📅 Check-out: <span className="font-medium text-foreground">{formatDateValue(newD.checkOutDate)}</span></div>
        {newD.guestCount != null && (
          <div>👥 Huéspedes: <span className="font-medium text-foreground">{newD.guestCount}</span></div>
        )}
        {newD.specialRequests && (
          <div>📝 Notas: <span className="font-medium text-foreground">{newD.specialRequests}</span></div>
        )}
      </div>
    );
  }

  if (entry.action === 'cancelled') {
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>📅 Check-in: <span className="font-medium text-foreground">{formatDateValue(oldD.checkInDate)}</span></div>
        <div>📅 Check-out: <span className="font-medium text-foreground">{formatDateValue(oldD.checkOutDate)}</span></div>
        {oldD.guestCount != null && (
          <div>👥 Huéspedes: <span className="font-medium text-foreground">{oldD.guestCount}</span></div>
        )}
      </div>
    );
  }

  // updated
  const diffs = [
    diffField('Propiedad', oldD.propertyName, newD.propertyName),
    diffField('Check-in', oldD.checkInDate, newD.checkInDate, true),
    diffField('Check-out', oldD.checkOutDate, newD.checkOutDate, true),
    diffField('Huéspedes', oldD.guestCount, newD.guestCount),
    diffField('Notas', oldD.specialRequests, newD.specialRequests),
  ].filter(Boolean);

  if (diffs.length === 0) {
    return <div className="text-xs text-muted-foreground italic">Sin cambios detectables.</div>;
  }
  return <div className="space-y-1">{diffs}</div>;
};

const groupByDay = (entries: ClientReservationHistoryEntry[]) => {
  const groups = new Map<string, ClientReservationHistoryEntry[]>();
  for (const e of entries) {
    const day = format(new Date(e.createdAt), 'yyyy-MM-dd');
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(e);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => (a > b ? -1 : 1));
};

export const ClientReservationHistoryModal = ({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ClientReservationHistoryModalProps) => {
  const { data: entries = [], isLoading, error } = useClientReservationHistory(
    clientId ?? undefined,
    { enabled: open && !!clientId },
  );

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [actorFilter, setActorFilter] = useState<ActorFilter>('all');

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (actorFilter !== 'all') {
        if (actorFilter === 'client' && e.actorType !== 'client') return false;
        if (actorFilter === 'internal' && e.actorType !== 'admin' && e.actorType !== 'manager') return false;
        if (actorFilter === 'system' && e.actorType !== 'system') return false;
      }
      if (search) {
        const haystack = [
          e.propertyName,
          e.propertyCode,
          e.actorName,
          e.actorEmail,
          (e.newData as any)?.specialRequests,
          (e.oldData as any)?.specialRequests,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [entries, actionFilter, actorFilter, search]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de cambios — {clientName ?? 'Cliente'}
          </DialogTitle>
          <DialogDescription>
            Registro auditado de todas las reservas creadas, editadas o canceladas en el portal de
            este cliente. Solo visible para administradores.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar propiedad, persona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActionFilter)}>
            <SelectTrigger><SelectValue placeholder="Tipo de acción" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              <SelectItem value="created">Añadidas</SelectItem>
              <SelectItem value="updated">Editadas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actorFilter} onValueChange={(v) => setActorFilter(v as ActorFilter)}>
            <SelectTrigger><SelectValue placeholder="Origen del cambio" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los orígenes</SelectItem>
              <SelectItem value="client">Cliente (portal)</SelectItem>
              <SelectItem value="internal">Equipo interno</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 min-h-[300px]">
          <div className="px-6 py-4">
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="py-12 text-center text-sm text-rose-600">
                No se pudo cargar el historial: {(error as Error).message}
              </div>
            ) : grouped.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {entries.length === 0
                  ? 'Aún no hay cambios registrados para este cliente.'
                  : 'Ningún registro coincide con los filtros aplicados.'}
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([day, dayEntries]) => (
                  <div key={day}>
                    <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-1 mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {format(new Date(day + 'T00:00:00'), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                      </h3>
                    </div>
                    <ol className="relative border-l border-border ml-2 space-y-3">
                      {dayEntries.map((entry) => {
                        const aMeta = actionMeta[entry.action] ?? actionMeta.updated;
                        const ActionIcon = aMeta.icon;
                        const aType = entry.actorType ?? 'system';
                        const acMeta = actorMeta[aType] ?? actorMeta.system;
                        const ActorIcon = acMeta.icon;
                        return (
                          <li key={entry.id} className="ml-4">
                            <span className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background ring-4 ring-background">
                              <span className={`h-2 w-2 rounded-full ${aMeta.className.replace('bg-', 'bg-').split(' ')[0]}`} />
                            </span>
                            <div className="rounded-lg border bg-card p-3 shadow-sm">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="outline" className={aMeta.className}>
                                  <ActionIcon className="h-3 w-3 mr-1" />
                                  {aMeta.label}
                                </Badge>
                                <Badge variant="outline" className={acMeta.className}>
                                  <ActorIcon className="h-3 w-3 mr-1" />
                                  {acMeta.label}
                                </Badge>
                                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(entry.createdAt), 'HH:mm')}
                                  <span className="text-muted-foreground/70">
                                    · {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: es })}
                                  </span>
                                </span>
                              </div>

                              {(entry.propertyName || entry.propertyCode) && (
                                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                                  <HomeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                  {entry.propertyName ?? '—'}
                                  {entry.propertyCode && (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      ({entry.propertyCode})
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="text-xs text-muted-foreground mb-2">
                                Por <span className="font-medium text-foreground">
                                  {entry.actorName ?? 'Sistema (sin registro de actor)'}
                                </span>
                                {entry.actorEmail && (
                                  <span className="ml-1 text-muted-foreground/70">
                                    ({entry.actorEmail})
                                  </span>
                                )}
                              </div>

                              {renderEntryDetails(entry)}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'}
            {entries.length !== filtered.length && ` (de ${entries.length})`}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientReservationHistoryModal;
