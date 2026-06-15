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

const item = (quantity: number, label: string) => quantity > 0 ? `${quantity} ${label}`.toUpperCase() : null;

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

const shouldMoveItemToBottom = (value: string) => {
  const name = normalizeItemName(value);
  return (
    name.includes('amenit') ||
    name.includes('papel') ||
    (name.includes('cocina') && (name.includes('pano') || name.includes('bayeta')))
  );
};

const buildBagItems = (bag: RouteBag): string[] => {
  const items: string[] = [];
  const bottomItems: string[] = [];
  const kitchenClothsQuantity = bag.amenities.kitchenCloths || 0;
  const pushItem = (quantity: number, label: string, forceBottom = false) => {
    const formatted = item(quantity, label);
    if (!formatted) return;
    if (forceBottom || shouldMoveItemToBottom(label)) bottomItems.push(formatted);
    else items.push(formatted);
  };

  if (bag.stockConsumables.length > 0) {
    bag.stockConsumables.forEach((stockItem) => {
      pushItem(stockItem.quantity, stockItem.name);
    });
    if (kitchenClothsQuantity > 0 && !hasKitchenClothStockItem(bag.stockConsumables)) {
      pushItem(kitchenClothsQuantity, 'PAÑOS DE COCINA', true);
    }
  } else {
    pushItem(bag.amenities.trashBags, 'BOLSAS BASURA');
    pushItem(bag.amenities.bathroomAmenities, 'AMENITIES DE BAÑO', true);
    pushItem(bag.amenities.kitchenAmenities, 'AMENITIES DE COCINA', true);
    pushItem(bag.amenities.foodKit, 'AMENITIES DE ALIMENTACIÓN', true);
  }

  pushItem(bag.textiles.pillowCases, 'FUNDAS ALMOHADA');
  pushItem(bag.textiles.bathMats, 'ALFOMBRINES');
  pushItem(bag.textiles.towelsSmall, 'TOALLAS PEQUEÑAS');
  pushItem(bag.textiles.sheets, 'SÁBANAS MATRIMONIO');
  pushItem(bag.textiles.sheetsSmall, 'SÁBANAS INDIVIDUALES');
  pushItem(bag.textiles.sheetsSuite, 'SÁBANAS SUITE');
  pushItem(bag.textiles.towelsLarge, 'TOALLAS GRANDES');

  if (bag.stockConsumables.length === 0) {
    pushItem(bag.amenities.toiletPaper, 'PAPEL HIGIÉNICO', true);
    pushItem(bag.amenities.kitchenPaper, 'PAPEL DE COCINA', true);
    pushItem(bag.amenities.shampoo, 'CHAMPÚ', true);
    pushItem(bag.amenities.conditioner, 'ACONDICIONADOR', true);
    pushItem(bag.amenities.showerGel, 'GEL DUCHA', true);
    pushItem(bag.amenities.liquidSoap, 'JABÓN LÍQUIDO', true);
    pushItem(bag.amenities.bathroomAirFreshener, 'AMBIENTADOR BAÑO', true);
    pushItem(bag.amenities.dishwasherDetergent, 'DETERGENTE LAVAVAJILLAS', true);
    if (kitchenClothsQuantity > 0) pushItem(kitchenClothsQuantity, 'PAÑOS DE COCINA', true);
    pushItem(bag.amenities.sponges, 'ESTROPAJOS', true);
    pushItem(bag.amenities.glassCleaner, 'LIMPIACRISTALES', true);
    pushItem(bag.amenities.bathroomDisinfectant, 'DESINFECTANTE BAÑO', true);
    pushItem(bag.amenities.oil, 'ACEITE', true);
    pushItem(bag.amenities.vinegar, 'VINAGRE', true);
    pushItem(bag.amenities.salt, 'SAL', true);
    pushItem(bag.amenities.sugar, 'AZÚCAR', true);
  }

  return [...items, ...bottomItems];
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
  const items = buildBagItems(bag);

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

        <div className="rounded-lg bg-white/80 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
            <Shirt className="h-4 w-4" />
            Contenido de la bolsa
          </p>
          <ul className="space-y-1">
            {items.length > 0 ? items.map((line, index) => (
              <li key={line} className="flex gap-2 text-base font-bold">
                <span className="w-8 shrink-0 text-foreground">{index + 1}º</span>
                <span>{line}</span>
              </li>
            )) : (
              <li className="text-sm text-muted-foreground">Sin consumos configurados</li>
            )}
          </ul>
        </div>

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
