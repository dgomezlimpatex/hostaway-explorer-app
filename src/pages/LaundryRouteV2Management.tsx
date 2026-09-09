import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
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
import { cn } from '@/lib/utils';
import { isRouteV2Owner } from '@/utils/routeV2Access';
import { LaundryPreparationTimings } from '@/components/laundry-share/LaundryPreparationTimings';

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

const invokeManagement = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('manage-laundry-route-v2-links', { body });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'No se pudo actualizar el nuevo sistema de ruta');
  return data as RouteManagementResponse & Record<string, unknown>;
};

const getPublicUrl = (token: string) => `${window.location.origin}/reparto/${token}`;

const routeStatus = (link: RouteLink) => {
  if (link.sync_status === 'error') return { label: 'Error de sincronización', className: 'border-red-200 bg-red-50 text-red-700' };
  return { label: 'Al día', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

const LaundryRouteV2Management = () => {
  const navigate = useNavigate();
  const { activeSede } = useSede();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const backgroundSyncStartedRef = useRef<Set<string>>(new Set());
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
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    const sedeId = activeSede?.id;
    if (!sedeId || !routesQuery.data || backgroundSyncStartedRef.current.has(sedeId)) return;

    backgroundSyncStartedRef.current.add(sedeId);
    setIsBackgroundSyncing(true);
    void invokeManagement({ action: 'reconcile', sedeId })
      .then(() => queryClient.invalidateQueries({ queryKey }))
      .catch((error) => console.error('Background route synchronization failed', error))
      .finally(() => setIsBackgroundSyncing(false));
  }, [activeSede?.id, queryClient, queryKey, routesQuery.data]);

  const refreshMutation = useMutation({
    mutationFn: () => invokeManagement({ action: 'force_reconcile', sedeId: activeSede?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Rutas actualizadas', description: 'Se han revisado los próximos repartos.' });
    },
    onError: (error) => toast({ title: 'No se pudo sincronizar', description: error instanceof Error ? error.message : 'Inténtalo de nuevo.', variant: 'destructive' }),
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
              <p className="truncate text-xs text-muted-foreground">Enlaces de reparto actualizados automáticamente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden gap-1.5 sm:flex"><LockKeyhole className="h-3.5 w-3.5" /> Separado del clásico</Badge>
            <Button variant="outline" size="icon" onClick={() => routesQuery.refetch()} disabled={routesQuery.isFetching} aria-label="Actualizar rutas">
              <RefreshCw className={cn('h-4 w-4', (routesQuery.isFetching || isBackgroundSyncing) && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        {isOwner && activeSede?.id && <LaundryPreparationTimings key={activeSede.id} sedeId={activeSede.id} />}
        <section className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Protocolo operativo</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Tres rutas listas, siempre actualizadas</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Este panel mantiene los próximos repartos del nuevo sistema. Las tareas nuevas, cancelaciones y cambios de contenido se aplican directamente al enlace, sin revisión ni aprobación.
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
              const previousPending = link.pendingPreparationCount ?? 0;
              const nextPending = link.nextPendingPreparationCount ?? 0;
              const totalPending = previousPending + nextPending;
              return (
                <Card key={link.id} className="overflow-hidden">
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
                        <span className="rounded-md bg-muted px-2 py-1 font-medium">{totalPending} por preparar</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid gap-2 sm:grid-cols-3" data-laundry-bag-summary>
                      <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bolsas totales</p><p className="mt-0.5 text-sm font-semibold">{totalPending} por preparar</p></div>
                      <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bolsas del día anterior</p><p className="mt-0.5 text-sm font-semibold">{previousPending} pendientes</p></div>
                      <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bolsas para la siguiente ruta</p><p className="mt-0.5 text-sm font-semibold">{nextPending} por preparar</p></div>
                    </div>

                    {link.sync_error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"><strong>Error:</strong> {link.sync_error}</div>}

                    <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1.5"><FileClock className="h-3.5 w-3.5" /> {isBackgroundSyncing ? 'Actualizando datos en segundo plano...' : 'Actualización automática cada 15 minutos'}</p>
                        <p>Última actualización: {formatDateTime(link.last_synced_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyLink(link.token)}><Copy className="h-3.5 w-3.5" /> {copiedToken === link.token ? 'Copiado' : 'Copiar'}</Button>
                        <Button size="sm" className="gap-1.5" onClick={() => window.open(getPublicUrl(link.token), '_blank')}><ExternalLink className="h-3.5 w-3.5" /> Abrir enlace</Button>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </main>

    </div>
  );
};

export default LaundryRouteV2Management;
