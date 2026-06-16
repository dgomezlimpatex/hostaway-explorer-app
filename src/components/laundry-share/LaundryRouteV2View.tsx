import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Shirt,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type BagStatus = 'pending' | 'prepared' | 'issue';
type DeliveryStatus = 'pending' | 'prepared' | 'delivered';
type CollectionStatus = 'pending' | 'collected';
type RouteAction = 'prepare' | 'issue' | 'collect' | 'deliver';

type RouteBag = {
  taskId: string;
  propertyCode: string;
  propertyName: string;
  address: string;
  date: string;
  serviceTime: string;
  cleaner: string | null;
  isNew: boolean;
  bagStatus: {
    status: BagStatus;
    issueReason: string | null;
  };
  deliveryTracking: {
    collectionStatus: CollectionStatus;
    deliveryStatus: DeliveryStatus;
  };
  textiles: Record<string, number>;
  amenities: Record<string, number>;
  stockConsumables: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitOfMeasure: string;
    categoryName: string | null;
  }>;
};

type RouteWorkflow = {
  workflowVersion: 'route_v2';
  route: {
    deliveryDate: string;
    routeName: string;
    routeDates: string[];
    nextDeliveryDate: string;
    nextRouteName: string;
    nextRouteDates: string[];
  };
  blockingStep: 'urgent' | 'prepare_next' | 'deliver';
  urgentBags: RouteBag[];
  nextRouteBags: RouteBag[];
  currentRouteBags: RouteBag[];
  stats: {
    urgentPending: number;
    nextTotal: number;
    nextPrepared: number;
    nextIssues: number;
    currentTotal: number;
    collected: number;
    delivered: number;
  };
};

interface LaundryRouteV2ViewProps {
  token: string;
}

const invokeWorkflow = async (
  token: string,
  action?: RouteAction,
  taskId?: string,
  issueReason?: string,
): Promise<RouteWorkflow> => {
  const { data, error } = await supabase.functions.invoke('laundry-route-workflow', {
    body: {
      token,
      action: action || 'load',
      taskId,
      issueReason,
    },
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'No se pudo cargar el reparto');
  return data.workflow as RouteWorkflow;
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T00:00:00`));

const normalizeItemName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const hasKitchenClothStockItem = (items: RouteBag['stockConsumables']) =>
  items.some((stockItem) => {
    const name = normalizeItemName(stockItem.name);
    return name.includes('cocina') && (name.includes('pano') || name.includes('bayeta'));
  });

type BagLayerId =
  | 'small_towels'
  | 'bath_mats'
  | 'sheets'
  | 'large_towels'
  | 'amenities'
  | 'kitchen_cloths'
  | 'paper_trash'
  | 'other';

type BagGuideItem = {
  quantity: number;
  label: string;
};

type BagGuideLayer = {
  id: BagLayerId;
  step: number;
  title: string;
  hint: string;
  items: BagGuideItem[];
};

const bagLayerDefinitions: Array<Omit<BagGuideLayer, 'items'>> = [
  { id: 'small_towels', step: 1, title: 'Toallas pequeñas', hint: 'Fondo de la bolsa' },
  { id: 'bath_mats', step: 2, title: 'Alfombrines', hint: 'Encima de las toallas pequeñas' },
  { id: 'sheets', step: 3, title: 'Sábanas y fundas', hint: 'Matrimonio, individuales o suite' },
  { id: 'large_towels', step: 4, title: 'Toallas grandes', hint: 'Bloque superior de textiles' },
  { id: 'amenities', step: 5, title: 'Amenities', hint: 'Kits de baño, cocina o alimentación' },
  { id: 'kitchen_cloths', step: 6, title: 'Paño de cocina', hint: 'Sobre los amenities' },
  { id: 'paper_trash', step: 7, title: 'Papel y bolsas', hint: 'Papel higiénico y bolsas de basura' },
  { id: 'other', step: 8, title: 'Otros consumibles', hint: 'Revisar antes de cerrar' },
];

const classifyStockConsumable = (value: string): BagLayerId => {
  const name = normalizeItemName(value);
  if (name.includes('papel') || name.includes('basura')) return 'paper_trash';
  if (name.includes('pano') || name.includes('bayeta')) return 'kitchen_cloths';
  if (name.includes('amenit') || name.includes('kit')) return 'amenities';
  return 'other';
};

const buildBagGuideLayers = (bag: RouteBag): BagGuideLayer[] => {
  const itemsByLayer = bagLayerDefinitions.reduce<Record<BagLayerId, BagGuideItem[]>>((acc, layer) => {
    acc[layer.id] = [];
    return acc;
  }, {} as Record<BagLayerId, BagGuideItem[]>);

  const kitchenClothsQuantity = bag.amenities.kitchenCloths || 0;
  const pushItem = (layer: BagLayerId, quantity: number, label: string) => {
    if (quantity <= 0) return;
    itemsByLayer[layer].push({ quantity, label: label.toUpperCase() });
  };

  pushItem('small_towels', bag.textiles.towelsSmall, 'Toallas pequeñas');
  pushItem('bath_mats', bag.textiles.bathMats, 'Alfombrines');
  pushItem('sheets', bag.textiles.sheets, 'Sábanas matrimonio');
  pushItem('sheets', bag.textiles.sheetsSmall, 'Sábanas individuales');
  pushItem('sheets', bag.textiles.sheetsSuite, 'Sábanas suite');
  pushItem('sheets', bag.textiles.pillowCases, 'Fundas almohada');
  pushItem('large_towels', bag.textiles.towelsLarge, 'Toallas grandes');

  if (bag.stockConsumables.length > 0) {
    bag.stockConsumables.forEach((stockItem) => {
      pushItem(classifyStockConsumable(stockItem.name), stockItem.quantity, stockItem.name);
    });
    if (kitchenClothsQuantity > 0 && !hasKitchenClothStockItem(bag.stockConsumables)) {
      pushItem('kitchen_cloths', kitchenClothsQuantity, 'Paños de cocina');
    }
  } else {
    pushItem('paper_trash', bag.amenities.trashBags, 'Bolsas basura');
    pushItem('amenities', bag.amenities.bathroomAmenities, 'Amenities de baño');
    pushItem('amenities', bag.amenities.kitchenAmenities, 'Amenities de cocina');
    pushItem('amenities', bag.amenities.foodKit, 'Amenities de alimentación');
    pushItem('paper_trash', bag.amenities.toiletPaper, 'Papel higiénico');
    pushItem('paper_trash', bag.amenities.kitchenPaper, 'Papel de cocina');
    pushItem('amenities', bag.amenities.shampoo, 'Champú');
    pushItem('amenities', bag.amenities.conditioner, 'Acondicionador');
    pushItem('amenities', bag.amenities.showerGel, 'Gel ducha');
    pushItem('amenities', bag.amenities.liquidSoap, 'Jabón líquido');
    pushItem('amenities', bag.amenities.bathroomAirFreshener, 'Ambientador baño');
    pushItem('amenities', bag.amenities.dishwasherDetergent, 'Detergente lavavajillas');
    pushItem('kitchen_cloths', kitchenClothsQuantity, 'Paños de cocina');
    pushItem('amenities', bag.amenities.sponges, 'Estropajos');
    pushItem('amenities', bag.amenities.glassCleaner, 'Limpiacristales');
    pushItem('amenities', bag.amenities.bathroomDisinfectant, 'Desinfectante baño');
    pushItem('amenities', bag.amenities.oil, 'Aceite');
    pushItem('amenities', bag.amenities.vinegar, 'Vinagre');
    pushItem('amenities', bag.amenities.salt, 'Sal');
    pushItem('amenities', bag.amenities.sugar, 'Azúcar');
  }

  return bagLayerDefinitions
    .map((layer) => ({ ...layer, items: itemsByLayer[layer.id] }))
    .filter((layer) => layer.items.length > 0);
};

const bagLayerAccent: Record<BagLayerId, string> = {
  small_towels: 'bg-sky-600',
  bath_mats: 'bg-cyan-700',
  sheets: 'bg-indigo-700',
  large_towels: 'bg-blue-700',
  amenities: 'bg-emerald-700',
  kitchen_cloths: 'bg-amber-600',
  paper_trash: 'bg-slate-800',
  other: 'bg-orange-600',
};

const BagAssemblyGuide = ({ bag }: { bag: RouteBag }) => {
  const layers = buildBagGuideLayers(bag);
  const visibleLayers = layers.filter((layer) => layer.id !== 'other');
  const otherLayer = layers.find((layer) => layer.id === 'other');

  if (layers.length === 0) {
    return (
      <div className="rounded-lg bg-white/80 p-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
          <Shirt className="h-4 w-4" />
          Contenido de la bolsa
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Sin consumos configurados</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-700">
          <Shirt className="h-4 w-4" />
          Guía de preparación
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black leading-tight">Orden de colocación</h3>
            <p className="text-sm text-muted-foreground">Empieza por el fondo y termina arriba.</p>
          </div>
          <div className="shrink-0 rounded-lg bg-white px-2 py-1 text-right shadow-sm">
            <p className="text-sm font-black">93 L</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">69 x 35 x 38</p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {visibleLayers.map((layer) => (
          <div
            key={layer.id}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3"
          >
            <div className="flex gap-3">
              <div className="flex shrink-0 flex-col items-center">
                <span className={cn(
                  'grid h-9 w-9 place-items-center rounded-full text-sm font-black text-white shadow-sm',
                  bagLayerAccent[layer.id],
                )}>
                  {layer.step}º
                </span>
                <span className="mt-1 h-full min-h-6 w-px bg-slate-200" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-black uppercase leading-tight">{layer.title}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{layer.hint}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {layer.items.map((guideItem, index) => (
                    <span
                      key={`${layer.id}-${guideItem.label}-${index}`}
                      className="rounded-lg bg-white px-2.5 py-1.5 text-sm font-black text-slate-950 shadow-sm ring-1 ring-slate-200"
                    >
                      <span className="mr-1 rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white">
                        {guideItem.quantity}
                      </span>
                      {guideItem.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {otherLayer && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-black uppercase text-amber-900">Otros consumibles</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {otherLayer.items.map((guideItem, index) => (
              <span
                key={`other-${guideItem.label}-${index}`}
                className="rounded-md bg-white px-2 py-1 text-xs font-black text-amber-950"
              >
                {guideItem.quantity} {guideItem.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BagCard = ({
  bag,
  tone,
  children,
}: {
  bag: RouteBag;
  tone: 'urgent' | 'next';
  children: ReactNode;
}) => {
  return (
    <Card className={cn(
      'border-2 shadow-sm',
      tone === 'urgent' ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50',
    )}>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight">{bag.propertyCode}</h2>
                {bag.isNew && <Badge className="bg-red-600">NUEVA</Badge>}
              </div>
              <p className="text-sm font-semibold text-muted-foreground">{bag.propertyName}</p>
            </div>
            <Badge variant="outline" className="shrink-0 uppercase">
              {formatDate(bag.date)}
            </Badge>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="flex gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{bag.address || 'Sin dirección'}</span>
            </p>
            <p className="flex gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{bag.serviceTime}</span>
            </p>
            {bag.cleaner && (
              <p className="flex gap-2">
                <User className="h-4 w-4 shrink-0" />
                <span>{bag.cleaner}</span>
              </p>
            )}
          </div>
        </div>

        <BagAssemblyGuide bag={bag} />

        {children}
      </CardContent>
    </Card>
  );
};

export const LaundryRouteV2View = ({ token }: LaundryRouteV2ViewProps) => {
  const { toast } = useToast();
  const [issueTaskId, setIssueTaskId] = useState<string | null>(null);
  const [issueReason, setIssueReason] = useState('');

  const {
    data: workflow,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['laundry-route-v2', token],
    queryFn: () => invokeWorkflow(token),
    refetchOnWindowFocus: true,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, taskId, reason }: { action: RouteAction; taskId: string; reason?: string }) =>
      invokeWorkflow(token, action, taskId, reason),
    onSuccess: () => {
      setIssueTaskId(null);
      setIssueReason('');
      refetch();
    },
    onError: (err) => {
      toast({
        title: 'No se pudo actualizar',
        description: err instanceof Error ? err.message : 'Inténtalo de nuevo',
        variant: 'destructive',
      });
    },
  });

  const nextPendingBag = useMemo(
    () => workflow?.nextRouteBags.find((bag) => bag.bagStatus.status === 'pending') || null,
    [workflow?.nextRouteBags],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando flujo de reparto...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm text-center space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">No se pudo cargar el reparto</h1>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'El enlace no existe, ha expirado o no está disponible.'}
          </p>
          <Button onClick={() => refetch()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  const urgentBag = workflow.urgentBags[0] || null;
  const nextResolved = workflow.nextRouteBags.filter((bag) => bag.bagStatus.status !== 'pending').length;
  const nextCurrentPosition = nextPendingBag ? nextResolved + 1 : workflow.nextRouteBags.length;
  const flowBlocked = workflow.blockingStep !== 'deliver';

  const handleIssue = () => {
    if (!issueTaskId) return;
    if (issueReason.trim().length < 3) {
      toast({
        title: 'Motivo obligatorio',
        description: 'Explica brevemente por qué no se puede preparar esta bolsa.',
        variant: 'destructive',
      });
      return;
    }
    actionMutation.mutate({ action: 'issue', taskId: issueTaskId, reason: issueReason.trim() });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-primary">Reparto de lavandería</p>
              <h1 className="text-xl font-black">
                {workflow.route.routeName} {formatDate(workflow.route.deliveryDate)}
              </h1>
              <p className="text-sm text-muted-foreground">
                Próxima ruta: {workflow.route.nextRouteName} {formatDate(workflow.route.nextDeliveryDate)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={actionMutation.isPending}>
              <RefreshCw className={cn('h-4 w-4', actionMutation.isPending && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-8">
        {urgentBag && (
          <section className="space-y-3">
            <div className="rounded-xl border-2 border-red-300 bg-red-100 p-4 text-red-950">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="font-black uppercase">Alerta importante</h2>
              </div>
              <p className="mt-1 text-sm font-semibold">
                Hay {workflow.stats.urgentPending} {workflow.stats.urgentPending === 1 ? 'bolsa' : 'bolsas'} de la ruta actual pendientes de preparación. Deben prepararse y entregarse hoy antes de continuar con el resto del proceso.
              </p>
            </div>

            <BagCard bag={urgentBag} tone="urgent">
              {issueTaskId === urgentBag.taskId ? (
                <div className="space-y-2">
                  <Textarea
                    value={issueReason}
                    onChange={(event) => setIssueReason(event.target.value)}
                    placeholder="Motivo de la incidencia..."
                    className="bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setIssueTaskId(null)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleIssue} disabled={actionMutation.isPending}>
                      Guardar incidencia
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    size="lg"
                    onClick={() => actionMutation.mutate({ action: 'prepare', taskId: urgentBag.taskId })}
                    disabled={actionMutation.isPending}
                    className="h-12 text-base font-black"
                  >
                    <PackageCheck className="mr-2 h-5 w-5" />
                    Bolsa preparada
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setIssueTaskId(urgentBag.taskId)}
                    disabled={actionMutation.isPending}
                    className="h-12 border-red-300 text-red-700"
                  >
                    <XCircle className="mr-2 h-5 w-5" />
                    Marcar incidencia
                  </Button>
                </div>
              )}
            </BagCard>
          </section>
        )}

        {!urgentBag && nextPendingBag && (
          <section className="space-y-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Preparación de la siguiente ruta
              </p>
              <h2 className="text-lg font-black">
                Bolsa {nextCurrentPosition} de {workflow.stats.nextTotal}
              </h2>
              <p className="text-sm text-muted-foreground">
                Se prepara para {workflow.route.nextRouteName} {formatDate(workflow.route.nextDeliveryDate)}.
              </p>
            </div>

            <BagCard bag={nextPendingBag} tone="next">
              {issueTaskId === nextPendingBag.taskId ? (
                <div className="space-y-2">
                  <Textarea
                    value={issueReason}
                    onChange={(event) => setIssueReason(event.target.value)}
                    placeholder="Motivo de la incidencia..."
                    className="bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setIssueTaskId(null)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleIssue} disabled={actionMutation.isPending}>
                      Guardar incidencia
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    size="lg"
                    onClick={() => actionMutation.mutate({ action: 'prepare', taskId: nextPendingBag.taskId })}
                    disabled={actionMutation.isPending}
                    className="h-12 text-base font-black"
                  >
                    <PackageCheck className="mr-2 h-5 w-5" />
                    Bolsa preparada
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setIssueTaskId(nextPendingBag.taskId)}
                    disabled={actionMutation.isPending}
                    className="h-12"
                  >
                    <XCircle className="mr-2 h-5 w-5" />
                    Marcar incidencia
                  </Button>
                </div>
              )}
            </BagCard>
          </section>
        )}

        {!flowBlocked && (
          <section className="space-y-3">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-950">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="font-black">Preparación completada</h2>
              </div>
              <p className="mt-1 text-sm">
                Ya puedes recoger ropa sucia y entregar la limpia de la ruta actual.
              </p>
            </div>

            <div className="space-y-2">
              {workflow.currentRouteBags.map((bag) => {
                const collected = bag.deliveryTracking.collectionStatus === 'collected';
                const delivered = bag.deliveryTracking.deliveryStatus === 'delivered';
                return (
                  <Card key={bag.taskId} className="bg-white">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-black">{bag.propertyCode}</p>
                            {bag.bagStatus.status === 'issue' && <Badge variant="destructive">INCIDENCIA</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDate(bag.date)} · {bag.cleaner || 'Sin trabajador'}</p>
                        </div>
                        <Badge variant={delivered ? 'default' : 'outline'}>
                          {delivered ? 'ENTREGADA' : 'PENDIENTE'}
                        </Badge>
                      </div>

                      {bag.bagStatus.status === 'issue' && bag.bagStatus.issueReason && (
                        <div className="rounded-md bg-red-50 p-2 text-xs text-red-800">
                          Incidencia: {bag.bagStatus.issueReason}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={collected ? 'secondary' : 'outline'}
                          disabled={collected || actionMutation.isPending}
                          onClick={() => actionMutation.mutate({ action: 'collect', taskId: bag.taskId })}
                        >
                          <Shirt className="mr-2 h-4 w-4" />
                          {collected ? 'Recogida' : 'Recoger'}
                        </Button>
                        <Button
                          disabled={delivered || actionMutation.isPending}
                          onClick={() => actionMutation.mutate({ action: 'deliver', taskId: bag.taskId })}
                        >
                          <Truck className="mr-2 h-4 w-4" />
                          {delivered ? 'Entregada' : 'Entregar'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
