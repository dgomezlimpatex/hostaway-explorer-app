import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PackageCheck,
  Shirt,
  Truck,
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

type QuantityLabel = {
  singular: string;
  plural: string;
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
  { id: 'bath_mats', step: 2, title: 'Alfombrines', hint: 'Sobre toallas peq.' },
  { id: 'sheets', step: 3, title: 'Sábanas y fundas', hint: 'Capa central' },
  { id: 'large_towels', step: 4, title: 'Toallas grandes', hint: 'Sobre sábanas' },
  { id: 'amenities', step: 5, title: 'Amenities', hint: 'Parte superior' },
  { id: 'kitchen_cloths', step: 6, title: 'Paño cocina', hint: 'Arriba' },
  { id: 'paper_trash', step: 7, title: 'Papel y bolsas', hint: 'Último' },
  { id: 'other', step: 8, title: 'Otros consumibles', hint: 'Revisar antes de cerrar' },
];

const classifyStockConsumable = (value: string): BagLayerId => {
  const name = normalizeItemName(value);
  if (name.includes('papel') || name.includes('basura')) return 'paper_trash';
  if (name.includes('pano') || name.includes('bayeta')) return 'kitchen_cloths';
  if (name.includes('amenit') || name.includes('kit')) return 'amenities';
  return 'other';
};

const getBagSizeSuffix = (value: string) => {
  const match = value.match(/\b(\d+\s*l)\b/i);
  return match ? ` ${match[1].replace(/\s+/g, '').toUpperCase()}` : '';
};

const formatCatalogItemLabel = (quantity: number, value: string) => {
  const name = normalizeItemName(value);
  const suffix = getBagSizeSuffix(value);

  if (name.includes('bolsa') && name.includes('basura')) {
    return quantity === 1 ? `BOLSA DE BASURA${suffix}` : `BOLSAS DE BASURA${suffix}`;
  }

  if ((name.includes('pano') || name.includes('bayeta')) && name.includes('cocina')) {
    return quantity === 1 ? 'PAÑO DE COCINA' : 'PAÑOS DE COCINA';
  }

  if (name.includes('papel') && name.includes('higienico')) {
    return quantity === 1 ? 'ROLLO DE PAPEL HIGIÉNICO' : 'ROLLOS DE PAPEL HIGIÉNICO';
  }

  if (name.includes('papel') && name.includes('cocina')) {
    return quantity === 1 ? 'ROLLO DE PAPEL DE COCINA' : 'ROLLOS DE PAPEL DE COCINA';
  }

  if (name.includes('amenit') && name.includes('bano')) {
    return quantity === 1 ? 'AMENITIE DE BAÑO' : 'AMENITIES DE BAÑO';
  }

  if (name.includes('amenit') && name.includes('cocina')) {
    return quantity === 1 ? 'AMENITIE DE COCINA' : 'AMENITIES DE COCINA';
  }

  if (name.includes('amenit') && name.includes('alimentacion')) {
    return quantity === 1 ? 'AMENITIE DE ALIMENTACIÓN' : 'AMENITIES DE ALIMENTACIÓN';
  }

  if (name.includes('kit') && name.includes('aliment')) {
    return quantity === 1 ? 'KIT ALIMENTARIO' : 'KITS ALIMENTARIOS';
  }

  if (name.includes('kit') && name.includes('cocina')) {
    return quantity === 1 ? 'KIT DE COCINA' : 'KITS DE COCINA';
  }

  return value.toLocaleUpperCase('es-ES');
};

const formatQuantityLabel = (quantity: number, label: QuantityLabel | string) => {
  if (typeof label === 'string') return formatCatalogItemLabel(quantity, label);
  return (quantity === 1 ? label.singular : label.plural).toLocaleUpperCase('es-ES');
};

const buildBagGuideLayers = (bag: RouteBag): BagGuideLayer[] => {
  const itemsByLayer = bagLayerDefinitions.reduce<Record<BagLayerId, BagGuideItem[]>>((acc, layer) => {
    acc[layer.id] = [];
    return acc;
  }, {} as Record<BagLayerId, BagGuideItem[]>);

  const kitchenClothsQuantity = bag.amenities.kitchenCloths || 0;
  const pushItem = (layer: BagLayerId, quantity: number, label: QuantityLabel | string) => {
    if (quantity <= 0) return;
    itemsByLayer[layer].push({ quantity, label: formatQuantityLabel(quantity, label) });
  };

  pushItem('small_towels', bag.textiles.towelsSmall, {
    singular: 'Toalla pequeña',
    plural: 'Toallas pequeñas',
  });
  pushItem('bath_mats', bag.textiles.bathMats, {
    singular: 'Alfombrín',
    plural: 'Alfombrines',
  });
  pushItem('sheets', bag.textiles.sheets, {
    singular: 'Sábana matrimonio',
    plural: 'Sábanas matrimonio',
  });
  pushItem('sheets', bag.textiles.sheetsSmall, {
    singular: 'Sábana individual',
    plural: 'Sábanas individuales',
  });
  pushItem('sheets', bag.textiles.sheetsSuite, {
    singular: 'Sábana suite',
    plural: 'Sábanas suite',
  });
  pushItem('sheets', bag.textiles.pillowCases, {
    singular: 'Funda almohada',
    plural: 'Fundas almohada',
  });
  pushItem('large_towels', bag.textiles.towelsLarge, {
    singular: 'Toalla grande',
    plural: 'Toallas grandes',
  });

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

const BagAssemblyGuide = ({ bag }: { bag: RouteBag }) => {
  const layers = buildBagGuideLayers(bag);
  const visibleLayers = layers.filter((layer) => layer.id !== 'other');
  const otherLayer = layers.find((layer) => layer.id === 'other');

  if (layers.length === 0) {
    return (
      <div className="rounded-xl bg-white/80 p-3">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#7a604b]">
          <Shirt className="h-4 w-4" />
          Contenido de la bolsa
        </p>
        <p className="mt-2 text-sm text-[#7a604b]">Sin consumos configurados</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="grid gap-1.5">
        {visibleLayers.map((layer) => (
          <div
            key={layer.id}
            className="rounded-xl border border-[#e7d8c7] bg-white px-2.5 py-2 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#c4512e] text-[13px] font-black text-white shadow-sm">
                {layer.step}º
              </span>

              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {layer.items.map((guideItem, index) => (
                  <span
                    key={`${layer.id}-${guideItem.label}-${index}`}
                    className="inline-flex min-w-0 items-center rounded-md bg-[#f5efe5] pr-2 text-[12px] font-black uppercase leading-6 tracking-tight text-[#17130f]"
                  >
                    <span className="mr-1.5 grid h-6 min-w-6 place-items-center rounded bg-[#1f1a14] px-1 text-[12px] font-black text-white">
                      {guideItem.quantity}
                    </span>
                    <span className="truncate">
                      {guideItem.label}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {otherLayer && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
          <p className="text-[11px] font-black uppercase text-amber-900">Otros consumibles</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {otherLayer.items.map((guideItem, index) => (
              <span
                key={`other-${guideItem.label}-${index}`}
                className="rounded bg-white px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-950"
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

const recalculateWorkflowStats = (workflow: RouteWorkflow): RouteWorkflow => {
  const urgentBags = workflow.currentRouteBags.filter((bag) => bag.bagStatus.status === 'pending');
  const nextPendingBags = workflow.nextRouteBags.filter((bag) => bag.bagStatus.status === 'pending');

  return {
    ...workflow,
    urgentBags,
    blockingStep: urgentBags.length > 0 ? 'urgent' : nextPendingBags.length > 0 ? 'prepare_next' : 'deliver',
    stats: {
      urgentPending: urgentBags.length,
      nextTotal: workflow.nextRouteBags.length,
      nextPrepared: workflow.nextRouteBags.filter((bag) => bag.bagStatus.status === 'prepared').length,
      nextIssues: workflow.nextRouteBags.filter((bag) => bag.bagStatus.status === 'issue').length,
      currentTotal: workflow.currentRouteBags.length,
      collected: workflow.currentRouteBags.filter((bag) => bag.deliveryTracking.collectionStatus === 'collected').length,
      delivered: workflow.currentRouteBags.filter((bag) => bag.deliveryTracking.deliveryStatus === 'delivered').length,
    },
  };
};

const updateWorkflowBag = (
  workflow: RouteWorkflow | undefined,
  taskId: string,
  updater: (bag: RouteBag) => RouteBag,
) => {
  if (!workflow) return workflow;

  return recalculateWorkflowStats({
    ...workflow,
    currentRouteBags: workflow.currentRouteBags.map((bag) => (bag.taskId === taskId ? updater(bag) : bag)),
    nextRouteBags: workflow.nextRouteBags.map((bag) => (bag.taskId === taskId ? updater(bag) : bag)),
  });
};

const BagCard = ({
  bag,
  tone,
  progress,
  isCompleteFlash = false,
  children,
}: {
  bag: RouteBag;
  tone: 'urgent' | 'next';
  progress: {
    pending: number;
    total: number;
  };
  isCompleteFlash?: boolean;
  children: ReactNode;
}) => {
  const progressCompleted = Math.max(progress.total - progress.pending, 0);
  const progressPercent = progress.total > 0 ? (progressCompleted / progress.total) * 100 : 0;

  return (
    <Card className={cn(
      'relative overflow-hidden rounded-[1.6rem] border bg-[#fbf6ec] shadow-sm transition-colors duration-200',
      tone === 'urgent' ? 'border-[#e2b29b]' : 'border-[#dac8b2]',
      isCompleteFlash && 'laundry-bag-complete-card border-emerald-400 bg-emerald-50',
    )}>
      {isCompleteFlash && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[1.6rem]">
          <div className="laundry-bag-complete-sweep absolute inset-0" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="laundry-bag-complete-badge rounded-full bg-white/95 p-4 text-emerald-600 shadow-2xl">
              <CheckCircle2 className="h-14 w-14" strokeWidth={3} />
            </div>
          </div>
        </div>
      )}
      <CardContent className="space-y-2.5 p-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a18465]">Bolsa actual</p>
            <div className="flex items-center gap-1.5">
              <h2 className="text-3xl font-black leading-none tracking-tight text-[#070b18]">{bag.propertyCode}</h2>
              {bag.isNew && <Badge className="bg-[#c4512e] text-white">Nueva</Badge>}
            </div>
          </div>
          <div className="w-[118px] shrink-0 text-right">
            <p className="text-[11px] font-black uppercase leading-tight text-[#17130f]">
              {progress.pending}/{progress.total}
            </p>
            <p className="text-[8px] font-black uppercase tracking-wider text-[#a18465]">bolsas pendientes</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e8d9c6]">
              <div
                className="h-full rounded-full bg-[#c4512e] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-[11px] font-black uppercase tracking-wide text-[#c4512e]">
          Coloca de abajo hacia arriba
        </p>

        <BagAssemblyGuide bag={bag} />

        {children}
      </CardContent>
    </Card>
  );
};

export const LaundryRouteV2View = ({ token }: LaundryRouteV2ViewProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [issueTaskId, setIssueTaskId] = useState<string | null>(null);
  const [issueReason, setIssueReason] = useState('');
  const [completeFlashTaskId, setCompleteFlashTaskId] = useState<string | null>(null);
  const queryKey = useMemo(() => ['laundry-route-v2', token], [token]);

  const {
    data: workflow,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => invokeWorkflow(token),
    refetchOnWindowFocus: true,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, taskId, reason }: { action: RouteAction; taskId: string; reason?: string }) =>
      invokeWorkflow(token, action, taskId, reason),
    onMutate: async ({ action, taskId, reason }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWorkflow = queryClient.getQueryData<RouteWorkflow>(queryKey);

      if (action === 'prepare') {
        setCompleteFlashTaskId(taskId);
        window.setTimeout(() => {
          queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
            updateWorkflowBag(current, taskId, (bag) => ({
              ...bag,
              bagStatus: {
                ...bag.bagStatus,
                status: 'prepared',
                issueReason: null,
              },
            })),
          );
          setCompleteFlashTaskId((current) => (current === taskId ? null : current));
        }, 680);
      }

      if (action === 'issue') {
        queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
          updateWorkflowBag(current, taskId, (bag) => ({
            ...bag,
            bagStatus: {
              ...bag.bagStatus,
              status: 'issue',
              issueReason: reason || null,
            },
          })),
        );
      }

      if (action === 'collect') {
        queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
          updateWorkflowBag(current, taskId, (bag) => ({
            ...bag,
            deliveryTracking: {
              ...bag.deliveryTracking,
              collectionStatus: 'collected',
            },
          })),
        );
      }

      if (action === 'deliver') {
        queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
          updateWorkflowBag(current, taskId, (bag) => ({
            ...bag,
            deliveryTracking: {
              ...bag.deliveryTracking,
              deliveryStatus: 'delivered',
            },
          })),
        );
      }

      return { previousWorkflow, taskId };
    },
    onSuccess: (updatedWorkflow, variables) => {
      setIssueTaskId(null);
      setIssueReason('');
      if (variables.action === 'prepare') {
        window.setTimeout(() => {
          queryClient.setQueryData(queryKey, updatedWorkflow);
        }, 690);
        return;
      }
      queryClient.setQueryData(queryKey, updatedWorkflow);
    },
    onError: (err, _variables, context) => {
      if (context?.previousWorkflow) {
        queryClient.setQueryData(queryKey, context.previousWorkflow);
      }
      if (context?.taskId) {
        setCompleteFlashTaskId((current) => (current === context.taskId ? null : current));
      }
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
  const urgentProgress = {
    pending: workflow.stats.urgentPending,
    total: workflow.currentRouteBags.length,
  };
  const nextProgress = {
    pending: workflow.nextRouteBags.filter((bag) => bag.bagStatus.status === 'pending').length,
    total: workflow.stats.nextTotal,
  };

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
    <div className="min-h-screen bg-[#eee8dc]">
      <main className="mx-auto max-w-md space-y-2 px-4 py-3 pb-6">
        {urgentBag && (
          <section className="space-y-2">
            <div className="rounded-xl border border-[#e2a993] bg-[#f7ded3] px-3 py-2 text-[#8d351e]">
              <p className="flex items-center gap-2 text-xs font-black leading-tight">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Hay {workflow.stats.urgentPending} {workflow.stats.urgentPending === 1 ? 'bolsa pendiente' : 'bolsas pendientes'} de preparar hoy.
              </p>
            </div>

            <BagCard
              bag={urgentBag}
              tone="urgent"
              progress={urgentProgress}
              isCompleteFlash={completeFlashTaskId === urgentBag.taskId}
            >
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
                    disabled={actionMutation.isPending || completeFlashTaskId === urgentBag.taskId}
                    className="h-12 rounded-xl bg-[#c4512e] text-sm font-black hover:bg-[#a94427]"
                  >
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Bolsa preparada
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setIssueTaskId(urgentBag.taskId)}
                    disabled={actionMutation.isPending || completeFlashTaskId === urgentBag.taskId}
                    className="h-9 rounded-xl border-0 bg-transparent text-sm font-semibold text-[#c4512e] hover:bg-[#f1dfcf]"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Marcar incidencia
                  </Button>
                </div>
              )}
            </BagCard>
          </section>
        )}

        {!urgentBag && nextPendingBag && (
          <section className="space-y-2">
            <div className="rounded-xl border border-[#dfd2bf] bg-[#fbf6ec] px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#a18465]">
                Preparación de la siguiente ruta
              </p>
              <h2 className="text-sm font-black text-[#17130f]">
                Bolsa {nextCurrentPosition} de {workflow.stats.nextTotal}
              </h2>
              <p className="text-[11px] text-[#7a604b]">
                Se prepara para {workflow.route.nextRouteName} {formatDate(workflow.route.nextDeliveryDate)}.
              </p>
            </div>

            <BagCard
              bag={nextPendingBag}
              tone="next"
              progress={nextProgress}
              isCompleteFlash={completeFlashTaskId === nextPendingBag.taskId}
            >
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
                    disabled={actionMutation.isPending || completeFlashTaskId === nextPendingBag.taskId}
                    className="h-12 rounded-xl bg-[#c4512e] text-sm font-black hover:bg-[#a94427]"
                  >
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Bolsa preparada
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setIssueTaskId(nextPendingBag.taskId)}
                    disabled={actionMutation.isPending || completeFlashTaskId === nextPendingBag.taskId}
                    className="h-9 rounded-xl border-0 bg-transparent text-sm font-semibold text-[#c4512e] hover:bg-[#f1dfcf]"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Marcar incidencia
                  </Button>
                </div>
              )}
            </BagCard>
          </section>
        )}

        {!flowBlocked && (
          <section className="space-y-2">
            <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-green-950">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <h2 className="text-sm font-black">Preparación completada</h2>
              </div>
              <p className="mt-1 text-xs">
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
