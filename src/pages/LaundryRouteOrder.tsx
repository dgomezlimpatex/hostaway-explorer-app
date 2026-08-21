import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  GripVertical,
  Info,
  Loader2,
  RefreshCw,
  Route,
  Save,
  Search,
} from 'lucide-react';
import { useSede } from '@/contexts/SedeContext';
import { useProperties } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CLASSIC_ROUTE_DAYS,
  fetchLaundryRouteOrder,
  saveLaundryRouteOrder,
} from '@/services/laundryRouteOrderService';

const LaundryRouteOrder = () => {
  const navigate = useNavigate();
  const { activeSede } = useSede();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const propertiesQuery = useProperties();
  const [selectedDay, setSelectedDay] = useState<number>(-1);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const routeOrderQuery = useQuery({
    queryKey: ['laundry-classic-route-order', activeSede?.id, selectedDay],
    queryFn: () => fetchLaundryRouteOrder(activeSede!.id, selectedDay),
    enabled: !!activeSede?.id,
  });

  const activeProperties = useMemo(() => {
    return (propertiesQuery.data || [])
      .filter((property) => property.isActive !== false && property.clientIsActive !== false)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }, [propertiesQuery.data]);

  const configuredPropertyIds = useMemo(() => {
    const activeIds = new Set(activeProperties.map((property) => property.id));
    return new Set(
      (routeOrderQuery.data || [])
        .filter((item) => activeIds.has(item.propertyId))
        .map((item) => item.propertyId),
    );
  }, [activeProperties, routeOrderQuery.data]);

  useEffect(() => {
    if (!routeOrderQuery.data || !propertiesQuery.data) return;
    const activeIds = new Set(activeProperties.map((property) => property.id));
    const configuredIds = routeOrderQuery.data
      .sort((a, b) => a.position - b.position)
      .map((item) => item.propertyId)
      .filter((id) => activeIds.has(id));
    const configuredSet = new Set(configuredIds);
    const unconfiguredIds = activeProperties
      .map((property) => property.id)
      .filter((id) => !configuredSet.has(id));
    const nextIds = [...configuredIds, ...unconfiguredIds];
    setOrderedIds(nextIds);
    setSavedIds(nextIds);
  }, [activeProperties, propertiesQuery.data, routeOrderQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeSede?.id) throw new Error('No hay sede activa');
      await saveLaundryRouteOrder({
        sedeId: activeSede.id,
        deliveryDay: selectedDay,
        propertyIds: orderedIds,
      });
    },
    onSuccess: () => {
      setSavedIds(orderedIds);
      queryClient.invalidateQueries({ queryKey: ['laundry-classic-route-order', activeSede?.id, selectedDay] });
      toast({
        title: 'Orden guardado',
        description: 'El enlace clásico usará este orden para la ruta seleccionada.',
      });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Revisa la conexión e inténtalo de nuevo.',
        variant: 'destructive',
      });
    },
  });

  const propertyById = useMemo(
    () => new Map(activeProperties.map((property) => [property.id, property])),
    [activeProperties],
  );

  const visibleIds = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return orderedIds;
    return orderedIds.filter((id) => {
      const property = propertyById.get(id);
      return property?.codigo.toLocaleLowerCase().includes(query)
        || property?.nombre.toLocaleLowerCase().includes(query)
        || property?.direccion.toLocaleLowerCase().includes(query);
    });
  }, [orderedIds, propertyById, search]);

  const moveProperty = (propertyId: string, direction: -1 | 1) => {
    setOrderedIds((current) => {
      const index = current.indexOf(propertyId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const moveBefore = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setOrderedIds((current) => {
      const sourceIndex = current.indexOf(sourceId);
      const targetIndex = current.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(next.indexOf(targetId), 0, sourceId);
      return next;
    });
  };

  const selectedDayLabel = CLASSIC_ROUTE_DAYS.find((day) => day.value === selectedDay)?.label || 'ruta';
  const selectedRouteTitle = selectedDay === -1
    ? 'Orden base para todas las rutas'
    : `Ruta del ${selectedDayLabel}`;
  const hasChanges = JSON.stringify(orderedIds) !== JSON.stringify(savedIds);
  const isLoading = propertiesQuery.isLoading || routeOrderQuery.isLoading;
  const unconfiguredCount = Math.max(activeProperties.length - configuredPropertyIds.size, 0);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/lavanderia/gestion')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Lavandería</p>
              <h1 className="truncate text-xl font-bold tracking-tight">Orden de rutas</h1>
              <p className="truncate text-xs text-muted-foreground">{activeSede?.nombre || 'Sede activa'}</p>
            </div>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending || isLoading}>
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar orden
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-card pb-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Route className="h-5 w-5" /></div>
                <div>
                  <CardTitle className="text-lg">¿En qué orden se hace la ruta?</CardTitle>
                  <CardDescription className="mt-1 max-w-2xl">
                    Organiza las propiedades como las recorre el repartidor. El enlace clásico respetará este orden después de la fecha.
                  </CardDescription>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 xl:min-w-[390px]">
                <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Activas</p>
                  <p className="mt-1 text-xl font-bold tracking-tight">{activeProperties.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Ordenadas</p>
                  <p className="mt-1 text-xl font-bold tracking-tight text-emerald-800 dark:text-emerald-200">{configuredPropertyIds.size}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Al final</p>
                  <p className="mt-1 text-xl font-bold tracking-tight text-amber-800 dark:text-amber-200">{unconfiguredCount}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Las propiedades nuevas o sin ordenar se añaden al final. Los enlaces ya compartidos conservan su orden hasta que se actualicen.</span>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[292px_minmax(0,1fr)]">
          <Card className="h-fit lg:sticky lg:top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Orden de las rutas</CardTitle>
              <CardDescription className="text-xs">Usa un orden común o crea una excepción.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {CLASSIC_ROUTE_DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setSelectedDay(day.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${day.value === -1 ? 'col-span-2 lg:col-span-1' : ''} ${selectedDay === day.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}
                >
                  <span className="block">{day.label}</span>
                  <span className={`text-[11px] font-normal ${selectedDay === day.value ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                    {day.value === -1 ? 'Orden base para todos los días' : day.value === 1 ? 'Servicios del lunes' : day.value === 3 ? 'Servicios de martes y miércoles' : day.value === 5 ? 'Servicios de jueves y viernes' : 'Servicios de sábado y domingo'}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-lg">{selectedRouteTitle}</CardTitle>
                  <CardDescription>
                    {search ? `${visibleIds.length} resultados de ${orderedIds.length}` : `${orderedIds.length} propiedades activas`} · {hasChanges ? 'Cambios sin guardar' : 'Orden guardado'}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar propiedad..." className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 lg:max-h-[calc(100vh-320px)] lg:overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground"><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Cargando propiedades...</div>
              ) : visibleIds.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay propiedades activas que coincidan con la búsqueda.</div>
              ) : (
                <div className="space-y-2">
                  {visibleIds.map((propertyId) => {
                    const property = propertyById.get(propertyId);
                    if (!property) return null;
                    const absoluteIndex = orderedIds.indexOf(propertyId);
                    return (
                      <div
                        key={property.id}
                        draggable
                        onDragStart={() => setDraggingId(property.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggingId) moveBefore(draggingId, property.id);
                          setDraggingId(null);
                        }}
                        className={`flex items-center gap-3 rounded-xl border bg-card px-3 py-3 transition-all ${draggingId === property.id ? 'opacity-50' : 'hover:border-primary/40 hover:shadow-sm'}`}
                      >
                        <GripVertical className="hidden h-5 w-5 shrink-0 cursor-grab text-muted-foreground sm:block" />
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{absoluteIndex + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{property.codigo}</span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{property.nombre}{property.direccion ? ` · ${property.direccion}` : ''}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveProperty(property.id, -1)} disabled={absoluteIndex === 0} aria-label="Subir propiedad">
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveProperty(property.id, 1)} disabled={absoluteIndex === orderedIds.length - 1} aria-label="Bajar propiedad">
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {hasChanges && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  <span>Hay cambios pendientes de guardar.</span>
                  <Button variant="ghost" size="sm" onClick={() => setOrderedIds(savedIds)}><Check className="mr-1.5 h-3.5 w-3.5" /> Deshacer</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default LaundryRouteOrder;
