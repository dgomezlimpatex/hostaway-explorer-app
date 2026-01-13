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

  // Calculate stats for this building
  const stats = building.apartments.reduce(
    (acc, apt) => {
      const tracking = trackingMap.get(apt.taskId);
      const status = tracking?.deliveryStatus || 'pending';
      if (status === 'delivered') {
        acc.delivered++;
      } else if (status === 'prepared') {
        acc.prepared++;
      } else {
        acc.pending++;
      }
      return acc;
    },
    { delivered: 0, prepared: 0, pending: 0 }
  );

  const allDelivered = stats.pending === 0 && stats.prepared === 0;
  const pendingPrepareTaskIds = building.apartments
    .filter(apt => {
      const tracking = trackingMap.get(apt.taskId);
      return !tracking || tracking.deliveryStatus === 'pending';
    })
    .map(apt => apt.taskId);
  
  const pendingDeliverTaskIds = building.apartments
    .filter(apt => {
      const tracking = trackingMap.get(apt.taskId);
      return tracking?.deliveryStatus === 'prepared';
    })
    .map(apt => apt.taskId);

  return (
    <Card className={cn(
      'transition-all',
      allDelivered && 'bg-green-50 dark:bg-green-950/20 border-green-200'
    )}>
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
                <CardTitle className="text-base font-semibold">
                  {building.buildingCode}
                </CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {building.totalApartments} aptos
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {allDelivered ? (
                  <Badge className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Entregado
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    {stats.delivered}/{building.totalApartments}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            {/* Apartment list with textile details */}
            <div className="space-y-2">
              {building.apartments.map(apt => {
                const tracking = trackingMap.get(apt.taskId);
                const status = tracking?.deliveryStatus || 'pending';
                const isPrepared = status === 'prepared';
                const isDelivered = status === 'delivered';
                const { textiles, amenities } = apt;

                // Build items list with full names
                const allItems: string[] = [];
                
                // Textiles
                if (textiles.sheets > 0) allItems.push(`${textiles.sheets} sábanas`);
                if (textiles.sheetsSmall > 0) allItems.push(`${textiles.sheetsSmall} sábanas pequeñas`);
                if (textiles.sheetsSuite > 0) allItems.push(`${textiles.sheetsSuite} sábanas suite`);
                if (textiles.pillowCases > 0) allItems.push(`${textiles.pillowCases} fundas almohada`);
                if (textiles.towelsLarge > 0) allItems.push(`${textiles.towelsLarge} toallas grandes`);
                if (textiles.towelsSmall > 0) allItems.push(`${textiles.towelsSmall} toallas pequeñas`);
                if (textiles.bathMats > 0) allItems.push(`${textiles.bathMats} alfombrines`);
                
                // Amenities
                if (amenities.toiletPaper > 0) allItems.push(`${amenities.toiletPaper} papel higiénico`);
                if (amenities.kitchenPaper > 0) allItems.push(`${amenities.kitchenPaper} papel cocina`);
                if (amenities.shampoo > 0) allItems.push(`${amenities.shampoo} champú`);
                if (amenities.conditioner > 0) allItems.push(`${amenities.conditioner} acondicionador`);
                if (amenities.showerGel > 0) allItems.push(`${amenities.showerGel} gel ducha`);
                if (amenities.liquidSoap > 0) allItems.push(`${amenities.liquidSoap} jabón líquido`);
                if (amenities.bathroomAmenities > 0) allItems.push(`${amenities.bathroomAmenities} amenities baño`);
                if (amenities.kitchenAmenities > 0) allItems.push(`${amenities.kitchenAmenities} amenities cocina`);
                if (amenities.bathroomAirFreshener > 0) allItems.push(`${amenities.bathroomAirFreshener} ambientador baño`);
                if (amenities.trashBags > 0) allItems.push(`${amenities.trashBags} bolsas basura`);
                if (amenities.dishwasherDetergent > 0) allItems.push(`${amenities.dishwasherDetergent} detergente lavavajillas`);
                if (amenities.kitchenCloths > 0) allItems.push(`${amenities.kitchenCloths} bayetas cocina`);
                if (amenities.sponges > 0) allItems.push(`${amenities.sponges} estropajos`);
                if (amenities.glassCleaner > 0) allItems.push(`${amenities.glassCleaner} limpiacristales`);
                if (amenities.bathroomDisinfectant > 0) allItems.push(`${amenities.bathroomDisinfectant} desinfectante baño`);
                if (amenities.oil > 0) allItems.push(`${amenities.oil} aceite`);
                if (amenities.vinegar > 0) allItems.push(`${amenities.vinegar} vinagre`);
                if (amenities.salt > 0) allItems.push(`${amenities.salt} sal`);
                if (amenities.sugar > 0) allItems.push(`${amenities.sugar} azúcar`);
                if (amenities.foodKit > 0) allItems.push(`${amenities.foodKit} kit alimentario`);

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
                          <span className={cn(
                            'font-semibold',
                            isDelivered && 'line-through text-muted-foreground'
                          )}>
                            {apt.propertyCode}
                          </span>
                          {isDelivered && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {isPrepared && (
                            <PackageCheck className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        {/* Service date and cleaner info */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(apt.date), "EEE d MMM", { locale: es })}
                          </span>
                          {apt.cleaner && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {apt.cleaner}
                            </span>
                          )}
                        </div>
                        {allItems.length > 0 && (
                          <p className={cn(
                            'text-sm text-muted-foreground mt-1',
                            isDelivered && 'line-through'
                          )}>
                            {allItems.join(' · ')}
                          </p>
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

            {/* Prepare all button */}
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

            {/* Deliver all button */}
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
