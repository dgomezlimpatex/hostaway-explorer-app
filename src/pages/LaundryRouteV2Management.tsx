import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileClock,
  LockKeyhole,
  RefreshCw,
  Route,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { isRouteV2Owner } from '@/utils/routeV2Access';

type RouteEvent = {
  id: string;
  task_id: string | null;
  event_type: string;
  novelty_type: string | null;
  property_code: string | null;
  payload: Record<string, unknown> | null;
  actor_name: string | null;
  created_at: string;
};

type RouteLink = {
  id: string;
  token: string;
  deliveryDate: string;
  routeName: string;
  nextDeliveryDate: string;
  sync_status: string | null;
  sync_error: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
  snapshot_task_ids: string[] | null;
  pendingNovelties: RouteEvent[];
  recentEvents: RouteEvent[];
  pendingPreparationCount?: number;
  nextPendingPreparationCount?: number;
  preparedCount?: number;
  issueCount?: number;
  unresolvedNoveltyCount?: number;
  pendingTaskIds?: string[];
  totalBags?: number;
};

type RouteManagementResponse = { links: RouteLink[] };

const formatDate = (value: string) => new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
}).format(new Date(`${value}T12:00:00`));

const formatDateTime = (value: string | null) => {
  if (!value) return 'Sin actualizar';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));
};

const eventLabel: Record<string, string> = {
  route_created: 'Ruta creada',
  route_refreshed: 'Ruta actualizada',
  task_added: 'Reserva nueva',
  task_changed: 'Tarea modificada',
  task_cancelled: 'Cancelación',
  bag_issue: 'Incidencia de preparación',
  bag_undo: 'Bolsa deshecha',
  bag_no_carry: 'No llevar',
  critical_block: 'Bloqueo crítico',
  admin_authorized: 'Ruta autorizada',
};

const invokeManagement = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('manage-laundry-route-v2-links', { body });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'No se pudo actualizar el nuevo sistema de ruta');
  return data as RouteManagementResponse & Record<string, unknown>;
};

const getPublicUrl = (token: string) => `${window.location.origin}/reparto/${token}`;

const routeStatus = (link: RouteLink) => {
  if (link.sync_status === 'error') return { label: 'Error de sincronización', className: 'border-red-200 bg-red-50 text-red-700' };
  const noveltyCount = Math.max(link.pendingNovelties.length, link.unresolvedNoveltyCount || 0);
  if (noveltyCount > 0) return { label: `${noveltyCount} novedad${noveltyCount === 1 ? '' : 'es'}`, className: 'border-amber-200 bg-amber-50 text-amber-800' };
  if ((link.pendingPreparationCount || 0) > 0) return { label: `${link.pendingPreparationCount} novedades pendientes`, className: 'border-sky-200 bg-sky-50 text-sky-700' };
  return { label: 'Al día', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

const LaundryRouteV2Management = () => {
  const navigate = useNavigate();
  const { activeSede } = useSede();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [authorizationLink, setAuthorizationLink] = useState<RouteLink | null>(null);
  const [authorizationReason, setAuthorizationReason] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const isOwner = isRouteV2Owner(user?.email);

  const queryKey = useMemo(() => ['laundry-route-v2-management', activeSede?.id], [activeSede?.id]);
  const routesQuery = useQuery({
    queryKey,
    enabled: Boolean(activeSede?.id),
    queryFn: async () => {
      const response = await invokeManagement({ action: 'list', sedeId: activeSede!.id });
      return response.links || [];
    },
    refetchInterval: 60_000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => invokeManagement({ action: 'force_reconcile', sedeId: activeSede?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Rutas actualizadas', description: 'Se han revisado los próximos repartos.' });
    },
    onError: (error) => toast({ title: 'No se pudo sincronizar', description: error instanceof Error ? error.message : 'Inténtalo de nuevo.', variant: 'destructive' }),
  });

  const authorizeMutation = useMutation({
    mutationFn: () => invokeManagement({
      action: 'authorize_continue',
      shareLinkId: authorizationLink?.id,
      reason: authorizationReason.trim(),
      affectedTaskIds: authorizationLink?.pendingTaskIds || authorizationLink?.pendingNovelties.map((event) => event.task_id).filter(Boolean) || [],
    }),
    onSuccess: () => {
      setAuthorizationLink(null);
      setAuthorizationReason('');
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Ruta autorizada', description: 'La autorización ha quedado registrada.' });
    },
    onError: (error) => toast({ title: 'No se pudo autorizar', description: error instanceof Error ? error.message : 'Inténtalo de nuevo.', variant: 'destructive' }),
  });

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(getPublicUrl(token));
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken((current) => current === token ? null : current), 1800);
    toast({ title: 'Enlace copiado', description: 'Ya puedes compartir el enlace del nuevo sistema.' });
  };

  const routes = routesQuery.data || [];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border/70 bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate('/lavanderia/gestion')} aria-label="Volver a lavandería">
              <ChevronDown className="h-4 w-4 rotate-90" />
            </Button>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Route className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Lavandería</p>
              <h1 className="truncate text-xl font-bold tracking-tight">Nuevo sistema de ruta</h1>
              <p className="truncate text-xs text-muted-foreground">Enlaces automáticos y novedades del reparto</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden gap-1.5 sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> Separado del clásico</Badge>
            <Button variant="outline" size="icon" onClick={() => routesQuery.refetch()} disabled={routesQuery.isFetching} aria-label="Actualizar rutas">
              <RefreshCw className={cn('h-4 w-4', routesQuery.isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        <section className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Protocolo operativo</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Tres rutas listas, siempre actualizadas</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Este panel mantiene los próximos repartos del nuevo sistema. Las tareas nuevas, cambios y cancelaciones se detectan al actualizar la ruta o al abrir el enlace.
              </p>
            </div>
            {isOwner ? (
              <Button onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending || !activeSede?.id} className="gap-2">
                <RefreshCw className={cn('h-4 w-4', refreshMutation.isPending && 'animate-spin')} />
                Sincronizar ahora
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" /> Solo Daniel modifica el protocolo
              </div>
            )}
          </div>
        </section>

        {!activeSede?.id ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Selecciona una sede para ver sus rutas.</CardContent></Card>
        ) : routesQuery.isLoading ? (
          <Card><CardContent className="flex min-h-56 items-center justify-center p-8 text-sm text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Revisando próximos repartos...</CardContent></Card>
        ) : routesQuery.error ? (
          <Card className="border-red-200"><CardContent className="flex items-start gap-3 p-5 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">No se pudieron cargar las rutas</p><p className="mt-1">{routesQuery.error instanceof Error ? routesQuery.error.message : 'Inténtalo de nuevo.'}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => routesQuery.refetch()}>Reintentar</Button></div></CardContent></Card>
        ) : routes.length === 0 ? (
          <Card><CardContent className="p-8 text-center"><CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">Todavía no hay rutas nuevas</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Comprueba que haya días de reparto activos. Este sistema no modifica ni genera enlaces clásicos.</p></CardContent></Card>
        ) : (
          <section className="space-y-3">
            {routes.map((link) => {
              const status = routeStatus(link);
              const isExpanded = expandedId === link.id;
              const totalTasks = link.totalBags ?? link.snapshot_task_ids?.length ?? 0;
              const events = link.pendingNovelties || [];
              return (
                <Card key={link.id} className={cn('overflow-hidden transition-shadow', events.length > 0 && 'border-amber-200 shadow-sm')}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Truck className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-lg capitalize">{formatDate(link.deliveryDate)}</CardTitle>
                            <Badge variant="outline" className={cn('font-medium', status.className)}>{status.label}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{link.routeName} · prepara la siguiente ruta del {formatDate(link.nextDeliveryDate)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-md bg-muted px-2 py-1 font-medium">{totalTasks} bolsas</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(isExpanded ? null : link.id)} aria-label={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bolsas incluidas</p><p className="mt-0.5 text-sm font-semibold">{totalTasks} bolsas</p></div>
                      <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Siguiente ruta</p><p className="mt-0.5 text-sm font-semibold">{link.nextPendingPreparationCount || 0} por preparar</p></div>
                      <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Última revisión</p><p className="mt-0.5 text-sm font-semibold">{formatDateTime(link.last_synced_at)}</p></div>
                      <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</p><p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold"><span className={cn('h-2 w-2 rounded-full', link.sync_status === 'error' ? 'bg-red-500' : events.length || (link.pendingPreparationCount || 0) > 0 ? 'bg-amber-500' : 'bg-emerald-500')} />{link.sync_status === 'error' ? 'Revisar error' : events.length || (link.pendingPreparationCount || 0) > 0 ? 'Requiere revisión' : 'Sin novedades'}</p></div>
                    </div>

                    {link.sync_error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><strong>Error:</strong> {link.sync_error}</div>}

                    <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileClock className="h-3.5 w-3.5" /> Actualización automática cada 15 minutos</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyLink(link.token)}><Copy className="h-3.5 w-3.5" /> {copiedToken === link.token ? 'Copiado' : 'Copiar'}</Button>
                        <Button size="sm" className="gap-1.5" onClick={() => window.open(getPublicUrl(link.token), '_blank')}><ExternalLink className="h-3.5 w-3.5" /> Abrir enlace</Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3 border-t pt-3">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Novedades y actividad</p><p className="text-xs text-muted-foreground">Las novedades no se pierden: quedan registradas en la ruta.</p></div>{events.length > 0 && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">{events.length} pendientes</Badge>}</div>
                        {events.length === 0 && (link.pendingPreparationCount || 0) === 0 ? <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"><CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-500" />No hay novedades pendientes.</div> : <div className="space-y-2">{events.length === 0 && <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">Hay {link.pendingPreparationCount} bolsas de la ruta actual pendientes.</div>}{events.map((event) => <div key={event.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium text-foreground">{eventLabel[event.event_type] || 'Novedad de ruta'}{event.property_code ? ` · ${event.property_code}` : ''}</p><p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}{event.novelty_type ? ` · ${event.novelty_type}` : ''}</p></div>{isOwner && <Button variant="outline" size="sm" onClick={() => { setAuthorizationLink(link); setAuthorizationReason(''); }}>Autorizar continuar</Button>}</div>)}{isOwner && ((link.pendingPreparationCount || 0) > 0 || events.length > 0) && <Button variant="outline" size="sm" onClick={() => { setAuthorizationLink(link); setAuthorizationReason(''); }}>Autorizar ruta incompleta</Button>}</div>}
                        {link.recentEvents?.length > 0 && (
                          <div className="space-y-2 border-t pt-3">
                            <p className="text-sm font-semibold">Historial reciente</p>
                            <div className="space-y-1.5">
                              {link.recentEvents.slice(0, 8).map((event) => (
                                <div key={event.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs">
                                  <span className="min-w-0 truncate">{eventLabel[event.event_type] || 'Actividad de ruta'}{event.property_code ? ` · ${event.property_code}` : ''}</span>
                                  <span className="shrink-0 text-muted-foreground">{formatDateTime(event.created_at)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </main>

      <Dialog open={Boolean(authorizationLink)} onOpenChange={(open) => !open && setAuthorizationLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizar ruta incompleta</DialogTitle>
            <DialogDescription>Esta autorización permite continuar de forma excepcional. Las bolsas afectadas seguirán pendientes y quedarán registradas para la siguiente ruta.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>{authorizationLink?.pendingTaskIds?.length || authorizationLink?.pendingNovelties.length || 0}</strong> bolsas quedarán asociadas a la autorización.</div>
          <Textarea value={authorizationReason} onChange={(event) => setAuthorizationReason(event.target.value)} placeholder="Indica por qué autorizas continuar..." className="min-h-24" />
          <DialogFooter><Button variant="outline" onClick={() => setAuthorizationLink(null)}>Cancelar</Button><Button onClick={() => authorizeMutation.mutate()} disabled={authorizationReason.trim().length < 3 || authorizeMutation.isPending}>{authorizeMutation.isPending ? 'Guardando...' : 'Autorizar continuación'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LaundryRouteV2Management;
