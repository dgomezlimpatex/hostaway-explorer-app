import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Building2, ChevronDown, ChevronRight, Truck, CheckCircle2, User, Calendar, PackageCheck } from 'lucide-react';
import { BuildingGroup, LaundryApartment } from '@/services/laundryScheduleService';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface BuildingDeliveryGroupProps {
  building: BuildingGroup;
  trackingMap: Map<string, { collectionStatus: string; deliveryStatus: string }>;
  onPrepare: (taskId: string) => void;
  onPrepareAll: (taskIds: string[]) => void;
  onDeliver: (taskId: string) => void;
  onDeliverAll: (taskIds: string[]) => void;
  isUpdating: boolean;
}

const formatDeliveryItem = (quantity: number, name: string) => `${quantity} ${name}`.toUpperCase();

const normalizeItemName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const hasKitchenClothStockItem = (items: LaundryApartment['stockConsumables']) =>
  items.some((item) => {
    const name = normalizeItemName(item.name);
    return name.includes('cocina') && (name.includes('pano') || name.includes('bayeta'));
  });

const buildApartmentItems = (apt: LaundryApartment): string[] => {
  const { textiles, amenities } = apt;
  const items: string[] = [];
  const kitchenClothsQuantity = amenities.kitchenCloths > 0 ? amenities.kitchenCloths : 1;

  if (apt.stockConsumables.length > 0) {
    apt.stockConsumables.forEach((item) => {
      items.push(formatDeliveryItem(item.quantity, item.name));
    });
    if (!hasKitchenClothStockItem(apt.stockConsumables)) {
      items.push(formatDeliveryItem(kitchenClothsQuantity, 'PAÑOS DE COCINA'));
    }
  } else {
    if (amenities.trashBags > 0) items.push(formatDeliveryItem(amenities.trashBags, 'BOLSAS BASURA'));
    if (amenities.bathroomAmenities > 0) items.push(formatDeliveryItem(amenities.bathroomAmenities, 'AMENITIES BAÑO'));
    if (amenities.kitchenAmenities > 0) items.push(formatDeliveryItem(amenities.kitchenAmenities, 'AMENITIES COCINA'));
    if (amenities.foodKit > 0) items.push(formatDeliveryItem(amenities.foodKit, 'KIT ALIMENTARIO'));
  }

  if (textiles.pillowCases > 0) items.push(formatDeliveryItem(textiles.pillowCases, 'FUNDAS ALMOHADA'));
  if (textiles.bathMats > 0) items.push(formatDeliveryItem(textiles.bathMats, 'ALFOMBRINES'));
  if (textiles.towelsSmall > 0) items.push(formatDeliveryItem(textiles.towelsSmall, 'TOALLAS PEQUEÑAS'));
  if (textiles.sheets > 0) items.push(formatDeliveryItem(textiles.sheets, 'SÁBANAS'));
  if (textiles.sheetsSmall > 0) items.push(formatDeliveryItem(textiles.sheetsSmall, 'SÁBANAS PEQUEÑAS'));
  if (textiles.sheetsSuite > 0) items.push(formatDeliveryItem(textiles.sheetsSuite, 'SÁBANAS SUITE'));
  if (textiles.towelsLarge > 0) items.push(formatDeliveryItem(textiles.towelsLarge, 'TOALLAS GRANDES'));

  if (apt.stockConsumables.length === 0) {
    if (amenities.toiletPaper > 0) items.push(formatDeliveryItem(amenities.toiletPaper, 'PAPEL HIGIÉNICO'));
    if (amenities.kitchenPaper > 0) items.push(formatDeliveryItem(amenities.kitchenPaper, 'PAPEL COCINA'));
    if (amenities.shampoo > 0) items.push(formatDeliveryItem(amenities.shampoo, 'CHAMPÚ'));
    if (amenities.conditioner > 0) items.push(formatDeliveryItem(amenities.conditioner, 'ACONDICIONADOR'));
    if (amenities.showerGel > 0) items.push(formatDeliveryItem(amenities.showerGel, 'GEL DUCHA'));
    if (amenities.liquidSoap > 0) items.push(formatDeliveryItem(amenities.liquidSoap, 'JABÓN LÍQUIDO'));
    if (amenities.bathroomAirFreshener > 0) items.push(formatDeliveryItem(amenities.bathroomAirFreshener, 'AMBIENTADOR BAÑO'));
    if (amenities.dishwasherDetergent > 0) items.push(formatDeliveryItem(amenities.dishwasherDetergent, 'DETERGENTE LAVAVAJILLAS'));
    items.push(formatDeliveryItem(kitchenClothsQuantity, 'PAÑOS DE COCINA'));
    if (amenities.sponges > 0) items.push(formatDeliveryItem(amenities.sponges, 'ESTROPAJOS'));
    if (amenities.glassCleaner > 0) items.push(formatDeliveryItem(amenities.glassCleaner, 'LIMPIACRISTALES'));
    if (amenities.bathroomDisinfectant > 0) items.push(formatDeliveryItem(amenities.bathroomDisinfectant, 'DESINFECTANTE BAÑO'));
    if (amenities.oil > 0) items.push(formatDeliveryItem(amenities.oil, 'ACEITE'));
    if (amenities.vinegar > 0) items.push(formatDeliveryItem(amenities.vinegar, 'VINAGRE'));
    if (amenities.salt > 0) items.push(formatDeliveryItem(amenities.salt, 'SAL'));
    if (amenities.sugar > 0) items.push(formatDeliveryItem(amenities.sugar, 'AZÚCAR'));
  }

  return items;
};

export const BuildingDeliveryGroup = ({
  building,
  trackingMap,
  onPrepare,
  onPrepareAll,
  onDeliver,
  onDeliverAll,
  isUpdating,
}: BuildingDeliveryGroupProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const stats = building.apartments.reduce(
    (acc, apt) => {
      const status = trackingMap.get(apt.taskId)?.deliveryStatus || 'pending';
      if (status === 'delivered') acc.delivered += 1;
      else if (status === 'prepared') acc.prepared += 1;
      else acc.pending += 1;
      return acc;
    },
    { delivered: 0, prepared: 0, pending: 0 }
  );

  const allDelivered = stats.pending === 0 && stats.prepared === 0;
  const pendingPrepareTaskIds = building.apartments
    .filter((apt) => !trackingMap.get(apt.taskId) || trackingMap.get(apt.taskId)?.deliveryStatus === 'pending')
    .map((apt) => apt.taskId);

  const pendingDeliverTaskIds = building.apartments
    .filter((apt) => trackingMap.get(apt.taskId)?.deliveryStatus === 'prepared')
    .map((apt) => apt.taskId);

  return (
    <Card className={cn('transition-all', allDelivered && 'bg-green-50 dark:bg-green-950/20 border-green-200')}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">{building.buildingCode}</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {building.totalApartments} aptos
                </Badge>
              </div>
              {allDelivered ? (
                <Badge className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Entregado
                </Badge>
              ) : (
                <Badge variant="outline">{stats.delivered}/{building.totalApartments}</Badge>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <div className="space-y-2">
              {building.apartments.map((apt) => {
                const status = trackingMap.get(apt.taskId)?.deliveryStatus || 'pending';
                const isPrepared = status === 'prepared';
                const isDelivered = status === 'delivered';
                const allItems = buildApartmentItems(apt);

                return (
                  <div
                    key={apt.taskId}
                    className={cn(
                      'p-3 rounded-md transition-colors',
                      isDelivered
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : isPrepared
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-muted/30 hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-semibold', isDelivered && 'line-through text-muted-foreground')}>
                            {apt.propertyCode}
                          </span>
                          {isDelivered && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {isPrepared && <PackageCheck className="h-4 w-4 text-blue-600" />}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(apt.date), 'EEE d MMM', { locale: es })}
                          </span>
                          {apt.cleaner && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {apt.cleaner}
                            </span>
                          )}
                        </div>
                        {allItems.length > 0 && (
                          <ul className={cn('mt-2 space-y-0.5 text-sm text-muted-foreground', isDelivered && 'line-through')}>
                            {allItems.map((item) => (
                              <li key={item} className="flex items-center gap-2">
                                <span className="h-1 w-1 rounded-full bg-current opacity-60 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {!isPrepared && !isDelivered && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPrepare(apt.taskId)}
                            disabled={isUpdating}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          >
                            <PackageCheck className="h-3 w-3 mr-1" />
                            Preparar
                          </Button>
                        )}
                        {isPrepared && !isDelivered && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDeliver(apt.taskId)}
                            disabled={isUpdating}
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            Entregar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {pendingPrepareTaskIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3 text-blue-600 border-blue-300 hover:bg-blue-50"
                onClick={() => onPrepareAll(pendingPrepareTaskIds)}
                disabled={isUpdating}
              >
                <PackageCheck className="h-4 w-4 mr-2" />
                Preparar todo ({pendingPrepareTaskIds.length})
              </Button>
            )}

            {pendingDeliverTaskIds.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="w-full mt-2 bg-green-600 hover:bg-green-700"
                onClick={() => onDeliverAll(pendingDeliverTaskIds)}
                disabled={isUpdating}
              >
                <Truck className="h-4 w-4 mr-2" />
                Entregar todo ({pendingDeliverTaskIds.length})
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
