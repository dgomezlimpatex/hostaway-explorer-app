import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Layers,
  LockKeyhole,
  LogOut,
  MapPin,
  PackageCheck,
  Shirt,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMadridDate } from '@/utils/date';

type BagStatus = 'pending' | 'prepared' | 'issue';
type DeliveryStatus = 'pending' | 'prepared' | 'delivered';
type CollectionStatus = 'pending' | 'collected';
type RouteAction = 'prepare' | 'issue' | 'critical_block' | 'collect' | 'deliver' | 'confirm_no_carry' | 'undo_bag' | 'complete_building';

type RouteWorkerIdentity = {
  routeWorkerId: string;
  cleanerId: string;
  workerName: string;
  sedeId: string;
};

type RouteAccessState = {
  sessionToken: string;
  expiresAt: string;
  worker: RouteWorkerIdentity;
};

// El reparto queda conservado para reactivarlo más adelante. Mientras esta
// bandera esté desactivada, el flujo pasa de novedades a la siguiente ruta.
const ROUTE_DELIVERY_ENABLED = false;

type RouteBag = {
  taskId: string;
  propertyCode: string;
  propertyName: string;
  address: string;
  date: string;
  serviceTime: string;
  cleaner: string | null;
  isNew: boolean;
  noveltyType?: 'normal' | 'new' | 'changed' | 'carryover' | 'cancelled_before' | 'cancelled_after' | 'undone';
  noveltyResolved?: boolean;
  isCancelled?: boolean;
  cancellationStage?: 'before_preparation' | 'after_preparation' | null;
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
  blockingStep: 'urgent' | 'deliver' | 'prepare_next' | 'complete';
  authorizedToContinue?: boolean;
  authorization?: {
    reason: string;
    actor_name: string | null;
    created_at: string;
  } | null;
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
  sessionToken?: string,
  action?: RouteAction,
  taskId?: string,
  issueReason?: string,
  taskIds?: string[],
): Promise<RouteWorkflow> => {
  const { data, error } = await supabase.functions.invoke('laundry-route-workflow', {
    body: {
      token,
      sessionToken,
      action: action || 'load',
      taskId,
      taskIds,
      issueReason,
    },
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'No se pudo cargar el reparto');
  return data.workflow as RouteWorkflow;
};

const invokeRouteAccess = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('laundry-route-access', { body });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.clone === 'function') {
      const payload = await context.clone().json().catch(() => null);
      if (payload?.error) message = String(payload.error);
    }
    throw new Error(message);
  }
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
  return data as T;
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
  | 'trash_bags'
  | 'bath_mats'
  | 'small_towels'
  | 'pillow_cases'
  | 'sheets'
  | 'large_towels'
  | 'kitchen_cloths'
  | 'amenities'
  | 'toilet_paper'
  | 'kitchen_paper'
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
  { id: 'trash_bags', step: 1, title: 'Bolsas de basura', hint: 'Fondo de la bolsa' },
  { id: 'bath_mats', step: 2, title: 'Alfombrines de ducha', hint: 'Sobre las bolsas' },
  { id: 'small_towels', step: 3, title: 'Toallas pequeñas', hint: 'Sobre los alfombrines' },
  { id: 'pillow_cases', step: 4, title: 'Fundas de almohada', hint: 'Antes de las sábanas' },
  { id: 'sheets', step: 5, title: 'Sábanas', hint: 'Todas las tipologías' },
  { id: 'large_towels', step: 6, title: 'Toallas grandes', hint: 'Sobre las sábanas' },
  { id: 'kitchen_cloths', step: 7, title: 'Paño de cocina', hint: 'Parte superior' },
  { id: 'amenities', step: 8, title: 'Amenities', hint: 'Los tres tipos' },
  { id: 'toilet_paper', step: 9, title: 'Papel higiénico', hint: 'Casi al final' },
  { id: 'kitchen_paper', step: 10, title: 'Papel de cocina', hint: 'Último' },
  { id: 'other', step: 11, title: 'Otros consumibles', hint: 'Revisar antes de cerrar' },
];

const classifyStockConsumable = (value: string): BagLayerId => {
  const name = normalizeItemName(value);
  if (name.includes('bolsa') && name.includes('basura')) return 'trash_bags';
  if (name.includes('papel') && name.includes('higienico')) return 'toilet_paper';
  if (name.includes('papel') && name.includes('cocina')) return 'kitchen_paper';
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
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    itemsByLayer[layer].push({ quantity, label: formatQuantityLabel(quantity, label) });
  };

  pushItem('bath_mats', bag.textiles.bathMats, {
    singular: 'Alfombrín',
    plural: 'Alfombrines',
  });
  pushItem('small_towels', bag.textiles.towelsSmall, {
    singular: 'Toalla pequeña',
    plural: 'Toallas pequeñas',
  });
  pushItem('pillow_cases', bag.textiles.pillowCases, {
    singular: 'Funda de almohada',
    plural: 'Fundas de almohada',
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
    pushItem('trash_bags', bag.amenities.trashBags, 'Bolsas basura');
    pushItem('amenities', bag.amenities.bathroomAmenities, 'Amenities de baño');
    pushItem('amenities', bag.amenities.kitchenAmenities, 'Amenities de cocina');
    pushItem('amenities', bag.amenities.foodKit, 'Amenities de alimentación');
    pushItem('toilet_paper', bag.amenities.toiletPaper, 'Papel higiénico');
    pushItem('kitchen_paper', bag.amenities.kitchenPaper, 'Papel de cocina');
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
  const containerRef = useRef<HTMLDivElement>(null);
  const items = buildBagGuideLayers(bag).flatMap((layer) =>
    layer.items.map((item, index) => ({ ...item, step: index === 0 ? layer.step : null })),
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const fit = () => {
      const setColumns = (columns: number) => {
        container.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
        container.style.gridTemplateRows = `repeat(${Math.max(1, Math.ceil(items.length / columns))}, minmax(0, 1fr))`;
      };
      const fits = () => Array.from(container.querySelectorAll<HTMLElement>('[data-bag-item]')).every((row) =>
        Array.from(row.children).every((child) => {
          const element = child as HTMLElement;
          return element.scrollHeight <= row.clientHeight - 4 && element.scrollWidth <= element.clientWidth + 1;
        }),
      );
      // Maximise readable type for the actual viewport and each bag's labels.
      let best = { columns: 1, size: 6 };
      for (const columns of container.clientWidth >= 560 ? [1, 2, 3, 4] : [1]) {
        setColumns(columns);
        let low = 6;
        let high = 28;
        for (let attempt = 0; attempt < 9; attempt += 1) {
          const size = (low + high) / 2;
          container.style.setProperty('--bag-font', `${size}px`);
          if (fits()) low = size;
          else high = size;
        }
        if (low > best.size) best = { columns, size: low };
      }
      setColumns(best.columns);
      container.style.setProperty('--bag-font', `${best.size}px`);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    fit();
    return () => observer.disconnect();
  }, [bag, items.length]);

  if (items.length === 0) {
    return <div className="grid min-h-0 flex-1 place-items-center rounded-xl bg-white text-sm text-[#7a604b]">Sin consumos configurados</div>;
  }

  return (
    <div ref={containerRef} data-bag-contents className="grid min-h-0 flex-1 grid-flow-col overflow-clip rounded-xl border border-[#e8e1d7] bg-white" style={{ fontSize: 'var(--bag-font, 16px)' }}>
      {items.map((item, index) => (
        <div key={index} data-bag-item className="grid min-h-0 min-w-0 grid-cols-[1.2em_1.7em_minmax(0,1fr)] items-center gap-1 border-b border-[#eee8df] px-2 py-0.5 last:border-b-0">
          <span className="text-center text-[#8c8378]" style={{ fontSize: '0.65em', lineHeight: 1.1 }}>{item.step ? `${item.step}º` : ''}</span>
          <span className="text-center font-bold tabular-nums text-[#17130f]" style={{ fontSize: '1.35em', lineHeight: 1.05 }}>{item.quantity}</span>
          <span className="min-w-0 break-words text-[#27231e]" style={{ lineHeight: 1.12 }}>
            {item.label.charAt(0).toLocaleUpperCase('es') + item.label.slice(1).toLocaleLowerCase('es')}
          </span>
        </div>
      ))}
    </div>
  );
};

const isRouteBagComplete = (bag: RouteBag) => (
  bag.deliveryTracking.collectionStatus === 'collected'
  && (bag.bagStatus.status === 'issue' || bag.deliveryTracking.deliveryStatus === 'delivered')
);

const recalculateWorkflowStats = (workflow: RouteWorkflow): RouteWorkflow => {
  const allUrgentBags = workflow.currentRouteBags.filter((bag) => bag.bagStatus.status === 'pending');
  const urgentBags = allUrgentBags;
  const nextPendingBags = workflow.nextRouteBags.filter((bag) => bag.bagStatus.status === 'pending');
  const routePending = ROUTE_DELIVERY_ENABLED && workflow.currentRouteBags
    .filter((bag) => !bag.isCancelled)
    .some((bag) => !isRouteBagComplete(bag));

  return {
    ...workflow,
    urgentBags,
    blockingStep: urgentBags.length > 0
      ? 'urgent'
      : routePending
        ? 'deliver'
        : nextPendingBags.length > 0
          ? 'prepare_next'
          : 'complete',
    stats: {
      urgentPending: allUrgentBags.length,
      nextTotal: workflow.nextRouteBags.length,
      nextPrepared: workflow.nextRouteBags.filter((bag) => bag.bagStatus.status === 'prepared').length,
      nextIssues: workflow.nextRouteBags.filter((bag) => bag.bagStatus.status === 'issue').length,
      currentTotal: workflow.currentRouteBags.length,
      collected: workflow.currentRouteBags.filter((bag) => bag.deliveryTracking.collectionStatus === 'collected').length,
      delivered: workflow.currentRouteBags.filter((bag) => bag.deliveryTracking.deliveryStatus === 'delivered').length,
    },
  };
};

const extractRouteBuildingCode = (propertyCode: string) => {
  const normalized = propertyCode.trim().replace(/\s*-\s*hu[eé]sped.*$/i, '');
  const match = normalized.match(/^([A-Za-z]+\d*)/);
  return (match?.[1] || normalized || 'SIN EDIFICIO').toUpperCase();
};

const groupRouteBagsByBuilding = (bags: RouteBag[]) => {
  const groups = new Map<string, RouteBag[]>();

  bags.forEach((bag) => {
    const buildingCode = extractRouteBuildingCode(bag.propertyCode);
    const current = groups.get(buildingCode) || [];
    current.push(bag);
    groups.set(buildingCode, current);
  });

  return Array.from(groups, ([buildingCode, groupedBags]) => ({ buildingCode, bags: groupedBags }));
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

const findWorkflowBag = (workflow: RouteWorkflow | undefined, taskId: string) =>
  workflow
    ? [...workflow.currentRouteBags, ...workflow.nextRouteBags].find((bag) => bag.taskId === taskId)
    : undefined;

const BagCard = ({
  bag,
  progress,
  isCompleteFlash = false,
  onDockHeight,
  children,
}: {
  bag: RouteBag;
  progress: {
    prepared: number;
    total: number;
  };
  isCompleteFlash?: boolean;
  onDockHeight: (height: number) => void;
  children: ReactNode;
}) => {
  const dockRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const observer = new ResizeObserver(() => onDockHeight(dock.getBoundingClientRect().height));
    observer.observe(dock);
    onDockHeight(dock.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [onDockHeight]);
  const progressCompleted = progress.prepared;
  const progressPercent = progress.total > 0 ? (progressCompleted / progress.total) * 100 : 0;

  return (
    <Card className={cn(
      'relative flex min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none transition-colors duration-200',
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
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-0">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#a18465]">Bolsa actual</p>
            <div className="flex items-center gap-1.5">
              <h2 className="min-w-0 break-words text-2xl font-bold leading-tight tracking-tight text-[#17130f]">{bag.propertyCode}</h2>
              {bag.isNew && <Badge className="bg-[#c4512e] text-white">Nueva</Badge>}
            </div>
          </div>
          <div className="w-[148px] shrink-0 text-right">
            <p data-bag-progress className="text-[11px] leading-4 text-[#766b5e]">
              {progressCompleted} de {progress.total} bolsas preparadas
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#e8d9c6]">
              <div
                className="h-full rounded-full bg-[#c4512e] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <p className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#a94427]">
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Coloca de abajo hacia arriba
        </p>

        <BagAssemblyGuide bag={bag} />

        {createPortal(
          <div ref={dockRef} data-laundry-actions className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e8e1d7] bg-[#faf7f1] px-4 pt-3 font-sans shadow-[0_-4px_20px_rgba(39,35,30,0.04)]" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto max-w-[416px]">{children}</div>
          </div>,
          document.body,
        )}
      </CardContent>
    </Card>
  );
};

const PreparationBuildingList = ({ bags, currentIds, busy, onPrepare }: {
  bags: RouteBag[];
  currentIds: Set<string>;
  busy: boolean;
  onPrepare: (taskId: string) => void;
}) => {
  const groups = new Map<string, RouteBag[]>();
  for (const bag of new Map(bags.filter((bag) => !bag.isCancelled).map((bag) => [bag.taskId, bag])).values()) {
    const code = bag.propertyCode.trim().toLocaleUpperCase('es-ES');
    const building = extractRouteBuildingCode(code);
    groups.set(building, [...(groups.get(building) || []), bag]);
  }
  return <section className="space-y-2" aria-label="Bolsas por edificio">
    {!groups.size && <p className="p-3 text-sm">No hay bolsas para preparar.</p>}
    {[...groups].sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true })).map(([building, items]) => (
      <details key={building} className="rounded-xl border border-[#dfd2bf] bg-[#fffaf2]">
        <summary className="cursor-pointer p-3 font-bold">{building}<span className="ml-2 text-xs font-normal">{items.length} pendientes</span></summary>
        <div className="space-y-2 px-3 pb-3">
          {[...items].sort((a, b) => a.propertyCode.localeCompare(b.propertyCode, 'es', { numeric: true }) || a.date.localeCompare(b.date)).map((bag) => (
            <article key={bag.taskId} className="rounded-lg border bg-white">
              <header className="p-3 text-sm">
                <strong>{bag.propertyCode}</strong> · {formatDate(bag.date)}
                <span className="mt-1 block text-xs">{currentIds.has(bag.taskId) ? 'Ruta actual' : 'Siguiente ruta'} · {bag.bagStatus.status === 'prepared' ? '✓ Preparada' : bag.bagStatus.status === 'issue' ? 'Incidencia' : 'Pendiente'}</span>
              </header>
              <div className="space-y-3 px-3 pb-3">
                <p className="text-xs">{bag.propertyName}</p>
                <div className="space-y-1">{buildBagGuideLayers(bag).flatMap((layer) => layer.items.map((item, index) => <div key={layer.id + '-' + index} className="flex gap-2 rounded bg-[#faf7f1] p-2 text-sm"><strong>{item.quantity}</strong><span>{item.label}</span></div>))}</div>
                {bag.bagStatus.issueReason && <p className="text-sm text-red-700">{bag.bagStatus.issueReason}</p>}
                <Button className="min-h-12 w-full" disabled={busy || bag.bagStatus.status === 'prepared'} onClick={() => onPrepare(bag.taskId)}><PackageCheck className="mr-2 h-4 w-4" />{bag.bagStatus.status === 'prepared' ? 'Preparada' : 'Marcar bolsa preparada'}</Button>
              </div>
            </article>
          ))}
        </div>
      </details>
    ))}
  </section>;
};

export const LaundryRouteV2View = ({ token }: LaundryRouteV2ViewProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const accessStorageKey = useMemo(() => `laundry-route-access:${token}`, [token]);
  const [routeAccess, setRouteAccess] = useState<RouteAccessState | null>(() => {
    try {
      const stored = window.localStorage.getItem(`laundry-route-access:${token}`);
      return stored ? JSON.parse(stored) as RouteAccessState : null;
    } catch {
      return null;
    }
  });
  const [pin, setPin] = useState('');
  const [showBuildings, setShowBuildings] = useState(false);
  const [issueTaskId, setIssueTaskId] = useState<string | null>(null);
  const [issueReason, setIssueReason] = useState('');
  const [completeFlashTaskId, setCompleteFlashTaskId] = useState<string | null>(null);
  const [pendingActionKeys, setPendingActionKeys] = useState<Set<string>>(() => new Set());
  const pendingActionKeysRef = useRef<Set<string>>(new Set());
  const [pendingBuildingCodes, setPendingBuildingCodes] = useState<Set<string>>(() => new Set());
  const [collapsedBuildings, setCollapsedBuildings] = useState<Set<string>>(() => new Set());
  const queryKey = useMemo(() => ['laundry-route-v2', token], [token]);
  const actionKey = (taskId: string, action: RouteAction) => `${taskId}:${action}`;
  const isActionPending = (taskId: string, action: RouteAction) => pendingActionKeys.has(actionKey(taskId, action));

  const { data: accessInfo, isLoading: isLoadingAccess, error: accessInfoError } = useQuery({
    queryKey: ['laundry-route-access-list', token],
    queryFn: () => invokeRouteAccess<{ success: true; required: boolean }>({
      action: 'list',
      token,
    }),
    retry: 1,
    staleTime: 60_000,
  });

  const accessRequired = accessInfo?.required === true;
  const { data: validatedAccess, isLoading: isValidatingAccess } = useQuery({
    queryKey: ['laundry-route-access-session', token, routeAccess?.sessionToken],
    queryFn: () => invokeRouteAccess<{ success: true; worker: RouteWorkerIdentity }>({
      action: 'validate',
      token,
      sessionToken: routeAccess?.sessionToken,
    }),
    enabled: accessRequired && Boolean(routeAccess?.sessionToken),
    retry: false,
  });

  useEffect(() => {
    if (!routeAccess?.expiresAt) return;
    if (new Date(routeAccess.expiresAt).getTime() > Date.now()) return;
    window.localStorage.removeItem(accessStorageKey);
    setRouteAccess(null);
  }, [accessStorageKey, routeAccess?.expiresAt]);

  const loginMutation = useMutation({
    mutationFn: () => invokeRouteAccess<RouteAccessState & { success: true }>({
      action: 'login',
      token,
      pin,
    }),
    onSuccess: (data) => {
      const nextAccess: RouteAccessState = {
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt,
        worker: data.worker,
      };
      window.localStorage.setItem(accessStorageKey, JSON.stringify(nextAccess));
      setRouteAccess(nextAccess);
      setPin('');
      queryClient.invalidateQueries({ queryKey: ['laundry-route-access-session', token] });
    },
    onError: (loginError) => {
      toast({
        title: 'No se pudo acceder',
        description: loginError instanceof Error ? loginError.message : 'Comprueba el PIN',
        variant: 'destructive',
      });
    },
  });

  const hasValidAccess = !accessRequired || Boolean(validatedAccess?.worker);

  const {
    data: workflow,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => invokeWorkflow(token, routeAccess?.sessionToken),
    enabled: Boolean(accessInfo) && hasValidAccess,
    refetchOnWindowFocus: pendingActionKeys.size === 0 && !issueTaskId,
    refetchInterval: pendingActionKeys.size === 0 && !issueTaskId ? 10_000 : false,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, taskId, reason }: { action: RouteAction; taskId: string; reason?: string }) =>
      invokeWorkflow(token, routeAccess?.sessionToken, action, taskId, reason),
    onMutate: ({ action, taskId, reason }) => {
      void queryClient.cancelQueries({ queryKey });
      const previousWorkflow = queryClient.getQueryData<RouteWorkflow>(queryKey);
      const previousBag = findWorkflowBag(previousWorkflow, taskId);
      setPendingActionKeys((current) => new Set(current).add(actionKey(taskId, action)));

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
              noveltyResolved: true,
              isCancelled: false,
            })),
          );
          setCompleteFlashTaskId((current) => (current === taskId ? null : current));
        }, 320);
      }

      if (action === 'issue' || action === 'critical_block') {
        queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
          updateWorkflowBag(current, taskId, (bag) => ({
            ...bag,
            bagStatus: {
              ...bag.bagStatus,
              status: 'issue',
              issueReason: reason || null,
            },
            // The issue remains recorded globally, but it is resolved for this
            // route so the operator can continue with the next bag.
            noveltyResolved: true,
          })),
        );
      }

      if (action === 'confirm_no_carry') {
        queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
          updateWorkflowBag(current, taskId, (bag) => ({ ...bag, noveltyResolved: true })),
        );
      }

      if (action === 'undo_bag') {
        queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
          updateWorkflowBag(current, taskId, (bag) => ({
            ...bag,
            noveltyResolved: false,
            noveltyType: 'undone',
            isCancelled: false,
            cancellationStage: null,
            bagStatus: { ...bag.bagStatus, status: 'pending' },
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

      return { previousBag, taskId, action };
    },
    onSuccess: (updatedWorkflow, variables) => {
      if (variables.action === 'prepare' || variables.action === 'collect' || variables.action === 'deliver') {
        return;
      }
      if (variables.action === 'issue' || variables.action === 'critical_block') {
        setIssueTaskId(null);
        setIssueReason('');
      }

      const updatedBag = findWorkflowBag(updatedWorkflow, variables.taskId);
      if (updatedBag) {
        queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
          updateWorkflowBag(current, variables.taskId, () => updatedBag),
        );
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousBag) {
        queryClient.setQueryData<RouteWorkflow>(queryKey, (current) =>
          updateWorkflowBag(current, context.taskId, (bag) => {
            if (variables.action === 'collect') {
              return {
                ...bag,
                deliveryTracking: {
                  ...bag.deliveryTracking,
                  collectionStatus: context.previousBag.deliveryTracking.collectionStatus,
                },
              };
            }
            if (variables.action === 'deliver') {
              return {
                ...bag,
                deliveryTracking: {
                  ...bag.deliveryTracking,
                  deliveryStatus: context.previousBag.deliveryTracking.deliveryStatus,
                },
              };
            }
            return context.previousBag;
          }),
        );
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
    onSettled: (_data, _error, variables) => {
      const key = actionKey(variables.taskId, variables.action);
      pendingActionKeysRef.current.delete(key);
      setPendingActionKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    },
  });

  const runAction = (variables: { action: RouteAction; taskId: string; reason?: string }) => {
    const key = actionKey(variables.taskId, variables.action);
    if (pendingActionKeysRef.current.has(key)) return;
    pendingActionKeysRef.current.add(key);
    actionMutation.mutate(variables);
  };

  const completeBuildingMutation = useMutation({
    mutationFn: ({ taskIds }: { buildingCode: string; taskIds: string[] }) =>
      invokeWorkflow(token, routeAccess?.sessionToken, 'complete_building', undefined, undefined, taskIds),
    onMutate: async ({ buildingCode, taskIds }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousWorkflow = queryClient.getQueryData<RouteWorkflow>(queryKey);
      const selectedTaskIds = new Set(taskIds);
      setPendingBuildingCodes((current) => new Set(current).add(buildingCode));
      setCollapsedBuildings((current) => new Set(current).add(buildingCode));
      queryClient.setQueryData<RouteWorkflow>(queryKey, (current) => {
        if (!current) return current;
        return recalculateWorkflowStats({
          ...current,
          currentRouteBags: current.currentRouteBags.map((bag) => selectedTaskIds.has(bag.taskId)
            ? {
              ...bag,
              deliveryTracking: {
                ...bag.deliveryTracking,
                collectionStatus: 'collected',
                deliveryStatus: bag.bagStatus.status === 'issue'
                  ? bag.deliveryTracking.deliveryStatus
                  : 'delivered',
              },
            }
            : bag),
        });
      });
      return { previousWorkflow, buildingCode };
    },
    onError: (err, _variables, context) => {
      if (context?.previousWorkflow) {
        queryClient.setQueryData<RouteWorkflow>(queryKey, context.previousWorkflow);
      }
      if (context?.buildingCode) {
        setCollapsedBuildings((current) => {
          const next = new Set(current);
          next.delete(context.buildingCode);
          return next;
        });
      }
      toast({
        title: 'No se pudo completar el edificio',
        description: err instanceof Error ? err.message : 'IntÃ©ntalo de nuevo',
        variant: 'destructive',
      });
    },
    onSettled: (_data, _error, _variables, context) => {
      const buildingCode = context?.buildingCode;
      if (!buildingCode) return;
      setPendingBuildingCodes((current) => {
        const next = new Set(current);
        next.delete(buildingCode);
        return next;
      });
    },
  });

  const nextPendingBag = useMemo(
    () => workflow?.nextRouteBags.find((bag) => bag.bagStatus.status === 'pending') || null,
    [workflow?.nextRouteBags],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [dockHeight, setDockHeight] = useState(144);
  const activeBagId = workflow?.urgentBags[0]?.taskId || nextPendingBag?.taskId;
  const hasWorkflow = Boolean(workflow);
  useEffect(() => {
    if (!hasWorkflow) return;
    const elements = [document.documentElement, document.body];
    const previous = elements.map((element) => ({ overflow: element.style.overflow, overscrollBehavior: element.style.overscrollBehavior }));
    elements.forEach((element) => {
      element.style.overflow = 'hidden';
      element.style.overscrollBehavior = 'none';
    });
    return () => elements.forEach((element, index) => {
      element.style.overflow = previous[index].overflow;
      element.style.overscrollBehavior = previous[index].overscrollBehavior;
    });
  }, [hasWorkflow]);
  useEffect(() => {
    // Start each new bag at its heading without moving the fixed action dock.
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [activeBagId]);

  const logoutRouteWorker = async () => {
    const sessionToken = routeAccess?.sessionToken;
    window.localStorage.removeItem(accessStorageKey);
    setRouteAccess(null);
    queryClient.removeQueries({ queryKey });
    if (sessionToken) {
      await invokeRouteAccess({ action: 'logout', token, sessionToken }).catch(() => undefined);
    }
  };

  if (isLoadingAccess || (accessRequired && routeAccess && isValidatingAccess)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eee8dc] p-4">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#c4512e]" />
          <p className="text-sm font-semibold text-[#6f5947]">Comprobando acceso a la ruta...</p>
        </div>
      </div>
    );
  }

  if (accessInfoError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eee8dc] p-4">
        <div className="max-w-sm space-y-3 rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="text-xl font-black text-slate-950">No se pudo comprobar el acceso</h1>
          <p className="text-sm text-slate-600">{accessInfoError instanceof Error ? accessInfoError.message : 'Intentalo de nuevo.'}</p>
          <Button onClick={() => window.location.reload()} className="w-full">Reintentar</Button>
        </div>
      </div>
    );
  }

  if (accessRequired && !hasValidAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eee8dc] p-4">
        <Card className="w-full max-w-sm overflow-hidden border-[#dfcdb7] bg-[#fffaf2] shadow-xl">
          <CardContent className="space-y-5 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c4512e] text-white">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a18465]">Nuevo sistema de ruta</p>
              <h1 className="mt-1 text-2xl font-black text-[#17130f]">Identificate para continuar</h1>
              <p className="mt-1 text-sm text-[#6f5947]">Introduce el PIN que tienes asignado en REGISTRO.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="route-pin">PIN de REGISTRO</Label>
              <Input
                id="route-pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && pin.length >= 3) loginMutation.mutate();
                }}
                placeholder="Introduce tu PIN"
                className="h-14 bg-white text-center text-xl font-black tracking-[0.25em]"
              />
            </div>

            <Button
              size="lg"
              className="h-14 w-full rounded-xl bg-[#c4512e] text-base font-black hover:bg-[#a94427]"
              disabled={pin.length < 3 || loginMutation.isPending}
              onClick={() => loginMutation.mutate()}
            >
              {loginMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LockKeyhole className="mr-2 h-5 w-5" />}
              Acceder a la ruta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
  const preparationBags = (urgentBag
    ? workflow.urgentBags
    : workflow.blockingStep === 'prepare_next' ? workflow.nextRouteBags : []
  ).filter((bag) => !bag.isCancelled && bag.bagStatus.status === 'pending');
  const buildingViewActive = showBuildings && preparationBags.length > 0;
  const deliveryGroups = groupRouteBagsByBuilding(workflow.currentRouteBags.filter((bag) => !bag.isCancelled));
  const urgentProgress = {
    prepared: workflow.currentRouteBags.filter((bag) => bag.bagStatus.status === 'prepared').length,
    total: workflow.currentRouteBags.length,
  };
  const nextProgress = {
    prepared: workflow.nextRouteBags.filter((bag) => bag.bagStatus.status === 'prepared').length,
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
    runAction({ action: 'issue', taskId: issueTaskId, reason: issueReason.trim() });
  };

  const openIssueForm = (taskId: string) => {
    setIssueTaskId(taskId);
    setIssueReason('');
  };

  return (
    <div ref={scrollContainerRef} className="fixed inset-x-0 top-0 h-dvh overflow-clip overscroll-none bg-[#faf7f1] font-sans" data-laundry-scroll>
      <main className="mx-auto flex h-full max-w-md flex-col gap-2 px-4 py-1.5 landscape:max-w-3xl" style={{ paddingBottom: buildingViewActive ? 12 : dockHeight + 12 }}>
        {accessRequired && routeAccess?.worker && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e8e1d7] pb-1">
            <div className="min-w-0">
              <p className="text-[10px] leading-3 text-[#766b5e]">Ruta iniciada por</p>
              <p className="truncate text-xs font-semibold leading-4 text-[#17130f]">{routeAccess.worker.workerName}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={logoutRouteWorker} className="h-11 shrink-0 px-2 text-xs text-[#8d351e]">
              <LogOut className="mr-1.5 h-4 w-4" />
              Cambiar
            </Button>
          </div>
        )}
        {preparationBags.length > 0 && <Button variant="outline" className="w-full shrink-0" aria-pressed={showBuildings} onClick={() => setShowBuildings(!showBuildings)}>{showBuildings ? 'Ver bolsas una a una' : 'Ver bolsas por edificio'}</Button>}
        {buildingViewActive && <div key={urgentBag ? 'urgent' : 'prepare_next'} className="min-h-0 flex-1 overflow-y-auto pb-3"><p className="mb-2 rounded-md bg-[#f1e8dc] px-2 py-1 text-xs font-semibold text-[#8d351e]">{urgentBag ? 'Pendientes para la ruta de hoy' : 'Bolsas para la siguiente ruta'}</p><PreparationBuildingList bags={preparationBags} currentIds={new Set(workflow.currentRouteBags.map((bag) => bag.taskId))} busy={pendingActionKeys.size > 0} onPrepare={(taskId) => runAction({ action: 'prepare', taskId })} /></div>}
        {!buildingViewActive && urgentBag && (
          <section className="flex min-h-0 flex-1 flex-col gap-2">
            <p data-bag-route className="shrink-0 rounded-md bg-[#f1e8dc] px-2 py-1 text-xs font-semibold leading-4 text-[#8d351e]">
              {workflow.route.deliveryDate === formatMadridDate(new Date()) ? 'Para entregar hoy' : `Entrega: ${formatDate(workflow.route.deliveryDate)}`} · Pendientes de la ruta anterior
            </p>
            <BagCard
              bag={urgentBag}
              progress={urgentProgress}
              onDockHeight={setDockHeight}
              isCompleteFlash={completeFlashTaskId === urgentBag.taskId}
            >
              {urgentBag.isCancelled ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                    <p className="font-black">NO LLEVAR ESTA BOLSA</p>
                    <p className="mt-0.5">La tarea fue cancelada {urgentBag.cancellationStage === 'after_preparation' ? 'después de preparar la bolsa' : 'antes de preparar la bolsa'}.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      size="lg"
                      onClick={() => runAction({ action: 'confirm_no_carry', taskId: urgentBag.taskId })}
                      disabled={isActionPending(urgentBag.taskId, 'confirm_no_carry')}
                      className="h-12 rounded-xl bg-[#c4512e] text-sm font-black hover:bg-[#a94427]"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmar no llevar
                    </Button>
                    {urgentBag.cancellationStage === 'after_preparation' && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => runAction({ action: 'undo_bag', taskId: urgentBag.taskId })}
                        disabled={isActionPending(urgentBag.taskId, 'undo_bag')}
                        className="h-12 rounded-xl text-sm font-semibold"
                      >
                        Bolsa deshecha
                      </Button>
                    )}
                  </div>
                </div>
              ) : issueTaskId === urgentBag.taskId ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#8d351e]">
                    Indica por qué no se puede preparar.
                  </p>
                  <select
                    value={issueReason}
                    onChange={(event) => setIssueReason(event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                  >
                    <option value="">Selecciona el motivo...</option>
                    <option value="Falta de stock de ropa">Falta de stock de ropa</option>
                    <option value="Incidencia en almacén">Incidencia en almacén</option>
                    <option value="Bolsa dañada">Bolsa dañada</option>
                    <option value="Problema con la tarea">Problema con la tarea</option>
                    <option value="Otro motivo">Otro motivo</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setIssueTaskId(null)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleIssue} disabled={isActionPending(urgentBag.taskId, 'issue')}>
                      Guardar incidencia
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-center gap-2 [@media(max-height:450px)_and_(orientation:landscape)]:grid-cols-2">
                  <Button
                    size="lg"
                    onClick={() => runAction({ action: 'prepare', taskId: urgentBag.taskId })}
                    className="h-16 touch-manipulation rounded-xl bg-[#c4512e] text-base font-semibold hover:bg-[#a94427]"
                  >
                    <PackageCheck className="mr-2 h-5 w-5" />
                    Bolsa preparada
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => openIssueForm(urgentBag.taskId)}
                    className="h-12 touch-manipulation rounded-xl border-transparent bg-transparent text-sm font-medium text-[#a94427] hover:bg-[#f1e8dc]"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Marcar incidencia
                  </Button>
                </div>
              )}
            </BagCard>
          </section>
        )}

        {!buildingViewActive && !urgentBag && workflow.blockingStep === 'prepare_next' && nextPendingBag && (
          <section className="flex min-h-0 flex-1 flex-col gap-2">
            <p data-bag-route className="shrink-0 rounded-md bg-[#f1e8dc] px-2 py-1 text-xs font-semibold leading-4 text-[#8d351e]">
              Para la siguiente ruta · {formatDate(workflow.route.nextDeliveryDate)}
            </p>

            <BagCard
              bag={nextPendingBag}
              progress={nextProgress}
              onDockHeight={setDockHeight}
              isCompleteFlash={completeFlashTaskId === nextPendingBag.taskId}
            >
              {issueTaskId === nextPendingBag.taskId ? (
                <div className="space-y-2">
                  <select
                    value={issueReason}
                    onChange={(event) => setIssueReason(event.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                  >
                    <option value="">Selecciona el motivo...</option>
                    <option value="Falta de stock de ropa">Falta de stock de ropa</option>
                    <option value="Incidencia en almacén">Incidencia en almacén</option>
                    <option value="Bolsa dañada">Bolsa dañada</option>
                    <option value="Problema con la tarea">Problema con la tarea</option>
                    <option value="Otro motivo">Otro motivo</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setIssueTaskId(null)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleIssue} disabled={isActionPending(nextPendingBag.taskId, 'issue')}>
                      Guardar incidencia
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-center gap-2 [@media(max-height:450px)_and_(orientation:landscape)]:grid-cols-2">
                  <Button
                    size="lg"
                    onClick={() => runAction({ action: 'prepare', taskId: nextPendingBag.taskId })}
                    className="h-16 touch-manipulation rounded-xl bg-[#c4512e] text-base font-semibold hover:bg-[#a94427]"
                  >
                    <PackageCheck className="mr-2 h-5 w-5" />
                    Bolsa preparada
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => openIssueForm(nextPendingBag.taskId)}
                    className="h-12 touch-manipulation rounded-xl border-transparent bg-transparent text-sm font-medium text-[#a94427] hover:bg-[#f1e8dc]"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Marcar incidencia
                  </Button>
                </div>
              )}
            </BagCard>
          </section>
        )}

        {!buildingViewActive && ROUTE_DELIVERY_ENABLED && !urgentBag && workflow.blockingStep === 'deliver' && (
          <section className="space-y-2">
            <div className="rounded-lg border border-[#dfd2bf] bg-[#fbf6ec] p-2.5 text-[#17130f]">
              <div className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-[#c4512e]" />
                <h2 className="text-sm font-black">Recogida y entrega de hoy</h2>
              </div>
              <p className="mt-1 text-xs">
                Recoge la ropa sucia y entrega las bolsas limpias preparadas anteriormente.
              </p>
            </div>

            <div className="space-y-2">
              {deliveryGroups.map((group) => {
                const collapsed = collapsedBuildings.has(group.buildingCode);
                const completed = group.bags.filter(isRouteBagComplete).length;
                const buildingComplete = completed === group.bags.length;
                const buildingPending = pendingBuildingCodes.has(group.buildingCode);
                return (
                  <Card
                    key={group.buildingCode}
                    className={cn(
                      'overflow-hidden transition-colors',
                      buildingComplete
                        ? 'border-green-200 bg-green-50'
                        : 'border-[#dfd2bf] bg-white',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setCollapsedBuildings((current) => {
                        const next = new Set(current);
                        if (next.has(group.buildingCode)) next.delete(group.buildingCode);
                        else next.add(group.buildingCode);
                        return next;
                      })}
                      className="flex w-full items-center gap-2 px-3 py-3 text-left"
                    >
                      <span className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                        buildingComplete ? 'bg-green-100 text-green-700' : 'bg-[#f1e8dc] text-[#7d3fc1]',
                      )}>
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-[#17130f]">{group.buildingCode}</span>
                        <span className={cn(
                          'block text-[11px] font-semibold',
                          buildingComplete ? 'text-green-700' : 'text-muted-foreground',
                        )}>
                          {completed}/{group.bags.length} apartamentos
                        </span>
                      </span>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', !collapsed && 'rotate-180')} />
                    </button>

                    {!buildingComplete && (
                      <div className="px-3 pb-3">
                        <Button
                          type="button"
                          className="h-12 w-full rounded-xl bg-[#3d0b9f] text-sm font-black hover:bg-[#2f087a]"
                          disabled={buildingPending}
                          onClick={() => completeBuildingMutation.mutate({
                            buildingCode: group.buildingCode,
                            taskIds: group.bags.map((bag) => bag.taskId),
                          })}
                        >
                          {buildingPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Recoger y entregar edificio
                        </Button>
                      </div>
                    )}

                    {!collapsed && (
                      <CardContent className={cn(
                        'space-y-2 border-t p-2',
                        buildingComplete ? 'border-green-200' : 'border-[#eee4d8]',
                      )}>
                        {group.bags.map((bag) => {
                          const collected = bag.deliveryTracking.collectionStatus === 'collected';
                          const delivered = bag.deliveryTracking.deliveryStatus === 'delivered';
                          const hasIssue = bag.bagStatus.status === 'issue';
                          return (
                            <div key={bag.taskId} className="space-y-2 rounded-xl bg-[#faf8f4] p-2.5">
                              <div className="flex items-start gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-base font-black text-[#101424]">{bag.propertyCode}</p>
                                    {bag.bagStatus.status === 'issue' && <Badge variant="destructive">INCIDENCIA</Badge>}
                                  </div>
                                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>{bag.address || 'Dirección no disponible'}</span>
                                  </p>
                                </div>
                              </div>

                              {bag.bagStatus.status === 'issue' && bag.bagStatus.issueReason && (
                                <div className="rounded-md bg-red-50 p-2 text-xs text-red-800">
                                  Incidencia: {bag.bagStatus.issueReason}
                                </div>
                              )}

                              <div className={cn('grid gap-2', hasIssue ? 'grid-cols-1' : 'grid-cols-2')}>
                                <Button
                                  variant={collected ? 'secondary' : 'outline'}
                                  disabled={collected}
                                  onClick={() => runAction({ action: 'collect', taskId: bag.taskId })}
                                >
                                  <Shirt className="mr-2 h-4 w-4" />
                                  {collected ? 'Recogida' : 'Recoger'}
                                </Button>
                                {!hasIssue && (
                                  <Button
                                    disabled={delivered}
                                    onClick={() => runAction({ action: 'deliver', taskId: bag.taskId })}
                                  >
                                    <Truck className="mr-2 h-4 w-4" />
                                    {delivered ? 'Entregada' : 'Entregar'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {!buildingViewActive && !urgentBag && workflow.blockingStep === 'complete' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-green-950">
            <CheckCircle2 className="mx-auto h-7 w-7" />
            <h2 className="mt-2 text-base font-black">Ruta completada</h2>
            <p className="mt-1 text-xs">La recogida, la entrega y la preparación de la siguiente ruta están terminadas.</p>
          </div>
        )}
      </main>
    </div>
  );
};
