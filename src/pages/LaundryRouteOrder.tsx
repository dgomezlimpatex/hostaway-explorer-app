import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Info,
  Loader2,
  RefreshCw,
  Route,
  Save,
  Search,
} from 'lucide-react';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useAllPropertyAssignments, usePropertyGroups } from '@/hooks/usePropertyGroups';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CLASSIC_ROUTE_DAYS,
  fetchLaundryRouteOrder,
  saveLaundryRouteOrder,
} from '@/services/laundryRouteOrderService';

interface RouteBlock {
  key: string;
  groupId: string | null;
  title: string;
  subtitle: string;
  propertyIds: string[];
}

const LaundryRouteOrder = () => {
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { activeSede } = useSede();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const propertiesQuery = useProperties();
  const propertyGroupsQuery = usePropertyGroups();
  const propertyAssignmentsQuery = useAllPropertyAssignments();
  const [selectedDay, setSelectedDay] = useState<number>(-1);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [draggingBlockKey, setDraggingBlockKey] = useState<string | null>(null);
  const [expandedBlockKeys, setExpandedBlockKeys] = useState<Set<string>>(() => new Set());

  const isRouteOwner = user?.email?.trim().toLowerCase() === 'dgomezlimpatex@gmail.com';

  const routeOrderQuery = useQuery({
    queryKey: ['laundry-classic-route-order', activeSede?.id, selectedDay],
    queryFn: () => fetchLaundryRouteOrder(activeSede!.id, selectedDay),
    enabled: !!activeSede?.id,
  });

  const activeProperties = useMemo(() => {
    return (propertiesQuery.data || [])
      .filter((property) => {
        const laundryEnabled = property.linenControlEnabled ?? property.clientLinenControlEnabled ?? false;
        return property.isActive !== false
          && property.clientIsActive !== false
          && laundryEnabled;
      })
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }, [propertiesQuery.data]);

  const propertyById = useMemo(
    () => new Map(activeProperties.map((property) => [property.id, property])),
    [activeProperties],
  );

  const activeGroupById = useMemo(
    () => new Map(
      (propertyGroupsQuery.data || [])
        .filter((group) => group.isActive)
        .map((group) => [group.id, group]),
    ),
    [propertyGroupsQuery.data],
  );

  const groupIdByPropertyId = useMemo(() => {
    const activePropertyIds = new Set(activeProperties.map((property) => property.id));
    const assignments = new Map<string, string>();
    (propertyAssignmentsQuery.data || []).forEach((assignment) => {
      if (
        assignment.propertyId
        && assignment.propertyGroupId
        && activePropertyIds.has(assignment.propertyId)
        && activeGroupById.has(assignment.propertyGroupId)
      ) {
        assignments.set(assignment.propertyId, assignment.propertyGroupId);
      }
    });
    return assignments;
  }, [activeGroupById, activeProperties, propertyAssignmentsQuery.data]);

  const inferredCodeGroupByPropertyId = useMemo(() => {
    const candidates = new Map<string, string[]>();
    const prefixByPropertyId = new Map<string, string>();

    activeProperties.forEach((property) => {
      const code = property.codigo.trim().toLocaleUpperCase();
      const match = code.match(/^(.+?)[._-](\d+[A-Z]?)$/);
      if (!match) return;

      const prefix = match[1];
      prefixByPropertyId.set(property.id, prefix);
      candidates.set(prefix, [...(candidates.get(prefix) || []), property.id]);
    });

    const sharedPrefixes = new Set(
      Array.from(candidates.entries())
        .filter(([, propertyIds]) => propertyIds.length > 1)
        .map(([prefix]) => prefix),
    );

    return new Map(
      Array.from(prefixByPropertyId.entries())
        .filter(([, prefix]) => sharedPrefixes.has(prefix))
        .map(([propertyId, prefix]) => [propertyId, prefix]),
    );
  }, [activeProperties]);

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
      .slice()
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

  const routeBlocks = useMemo<RouteBlock[]>(() => {
    const blocks = new Map<string, RouteBlock>();

    orderedIds.forEach((propertyId) => {
      const property = propertyById.get(propertyId);
      if (!property) return;

      const groupId = groupIdByPropertyId.get(propertyId) || null;
      const inferredPrefix = inferredCodeGroupByPropertyId.get(propertyId) || null;
      const key = groupId
        ? `group:${groupId}`
        : inferredPrefix
          ? `code:${inferredPrefix}`
          : `property:${propertyId}`;
      const group = groupId ? activeGroupById.get(groupId) : null;
      const title = group?.displayName || group?.name || inferredPrefix || property.codigo;
      const subtitle = group
        ? `${group.internalCode ? `${group.internalCode} · ` : ''}${group.name}`
        : inferredPrefix
          ? 'Agrupado automáticamente por código'
          : property.nombre;

      if (!blocks.has(key)) {
        blocks.set(key, { key, groupId, title, subtitle, propertyIds: [] });
      }
      blocks.get(key)!.propertyIds.push(propertyId);
    });

    return Array.from(blocks.values());
  }, [activeGroupById, groupIdByPropertyId, inferredCodeGroupByPropertyId, orderedIds, propertyById]);

  const visibleBlocks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return routeBlocks;
    return routeBlocks.filter((block) => {
      if (`${block.title} ${block.subtitle}`.toLocaleLowerCase().includes(query)) return true;
      return block.propertyIds.some((propertyId) => {
        const property = propertyById.get(propertyId);
        return `${property?.codigo || ''} ${property?.nombre || ''} ${property?.direccion || ''}`
          .toLocaleLowerCase()
          .includes(query);
      });
    });
  }, [propertyById, routeBlocks, search]);

  const flattenBlocks = (blocks: RouteBlock[]) => blocks.flatMap((block) => block.propertyIds);

  const moveBlock = (blockKey: string, direction: -1 | 1) => {
    setOrderedIds((current) => {
      const blocks = routeBlocks.map((block) => ({ ...block, propertyIds: [...block.propertyIds] }));
      const index = blocks.findIndex((block) => block.key === blockKey);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return current;
      [blocks[index], blocks[nextIndex]] = [blocks[nextIndex], blocks[index]];
      return flattenBlocks(blocks);
    });
  };

  const moveBlockBefore = (sourceKey: string, targetKey: string) => {
    if (sourceKey === targetKey) return;
    setOrderedIds((current) => {
      const blocks = routeBlocks.map((block) => ({ ...block, propertyIds: [...block.propertyIds] }));
      const sourceIndex = blocks.findIndex((block) => block.key === sourceKey);
      const targetIndex = blocks.findIndex((block) => block.key === targetKey);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [source] = blocks.splice(sourceIndex, 1);
      blocks.splice(blocks.findIndex((block) => block.key === targetKey), 0, source);
      return flattenBlocks(blocks);
    });
  };

  const toggleBlock = (blockKey: string) => {
    setExpandedBlockKeys((current) => {
      const next = new Set(current);
      if (next.has(blockKey)) next.delete(blockKey);
      else next.add(blockKey);
      return next;
    });
  };

  const selectedDayLabel = CLASSIC_ROUTE_DAYS.find((day) => day.value === selectedDay)?.label || 'ruta';
  const selectedRouteTitle = selectedDay === -1
    ? 'Orden base para todas las rutas'
    : `Ruta del ${selectedDayLabel}`;
  const hasChanges = JSON.stringify(orderedIds) !== JSON.stringify(savedIds);
  const isLoading = propertiesQuery.isLoading
    || routeOrderQuery.isLoading
    || propertyGroupsQuery.isLoading
    || propertyAssignmentsQuery.isLoading;
  const unconfiguredCount = Math.max(activeProperties.length - configuredPropertyIds.size, 0);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isRouteOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Configuración restringida</CardTitle>
            <CardDescription>
              Solo Daniel puede modificar los días y el orden de las rutas de lavandería.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/lavanderia/gestion')} className="w-full">
              Volver a enlaces de lavandería
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                    Organiza los edificios como los recorre el repartidor. El enlace clásico respetará este orden después de la fecha.
                  </CardDescription>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 xl:min-w-[390px]">
                <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Con lavandería</p>
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
              <span>Solo aparecen propiedades activas con lavandería activada. Ordena los edificios como bloques; sus propiedades se mantienen dentro del edificio y se ocultan para facilitar la ruta. Los códigos compartidos como CGA8.1, CGA8.2 y CGA8.3 se agrupan automáticamente como CGA8.</span>
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
                    {search ? `${visibleBlocks.length} bloques encontrados` : `${routeBlocks.length} bloques · ${orderedIds.length} propiedades`} · {hasChanges ? 'Cambios sin guardar' : 'Orden guardado'}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar edificio o propiedad..." className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 lg:max-h-[calc(100vh-320px)] lg:overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground"><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Cargando propiedades...</div>
              ) : visibleBlocks.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay bloques ni propiedades con lavandería activa que coincidan con la búsqueda.</div>
              ) : (
                <div className="space-y-2">
                  {visibleBlocks.map((block) => {
                    const absoluteIndex = routeBlocks.indexOf(block);
                    return (
                      <div
                        key={block.key}
                        draggable
                        onDragStart={() => setDraggingBlockKey(block.key)}
                        onDragEnd={() => setDraggingBlockKey(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggingBlockKey) moveBlockBefore(draggingBlockKey, block.key);
                          setDraggingBlockKey(null);
                        }}
                        className={`rounded-xl border bg-card p-3 transition-all ${draggingBlockKey === block.key ? 'opacity-50' : 'hover:border-primary/40 hover:shadow-sm'}`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleBlock(block.key)}
                            aria-expanded={expandedBlockKeys.has(block.key)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            {expandedBlockKeys.has(block.key) ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            <GripVertical className="hidden h-5 w-5 shrink-0 cursor-grab text-muted-foreground sm:block" />
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{absoluteIndex + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{block.title}</span>
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                  {block.propertyIds.length} {block.propertyIds.length === 1 ? 'propiedad' : 'propiedades'}
                                </span>
                              </div>
                              <p className="truncate text-xs text-muted-foreground">{block.subtitle}</p>
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(block.key, -1)} disabled={absoluteIndex === 0} aria-label="Subir edificio">
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(block.key, 1)} disabled={absoluteIndex === routeBlocks.length - 1} aria-label="Bajar edificio">
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {expandedBlockKeys.has(block.key) && (
                          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                            {block.propertyIds.map((propertyId, propertyIndex) => {
                            const property = propertyById.get(propertyId);
                            if (!property) return null;
                            return (
                              <div key={property.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-2">
                                <span className="w-5 text-center text-[11px] font-bold text-muted-foreground">{propertyIndex + 1}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{property.codigo}</p>
                                  <p className="truncate text-[11px] text-muted-foreground">{property.nombre}{property.direccion ? ` · ${property.direccion}` : ''}</p>
                                </div>
                              </div>
                            );
                            })}
                          </div>
                        )}
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
