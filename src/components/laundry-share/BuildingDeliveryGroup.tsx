import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Building2, ChevronDown, ChevronRight, Truck, CheckCircle2, User, Calendar } from 'lucide-react';
import { BuildingGroup, LaundryApartment } from '@/services/laundryScheduleService';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface BuildingDeliveryGroupProps {
  building: BuildingGroup;
  trackingMap: Map<string, { collectionStatus: string; deliveryStatus: string }>;
  onDeliver: (taskId: string) => void;
  onDeliverAll: (taskIds: string[]) => void;
  isUpdating: boolean;
}

export const BuildingDeliveryGroup = ({
  building,
  trackingMap,
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
      } else {
        acc.pending++;
      }
      return acc;
    },
    { delivered: 0, pending: 0 }
  );

  const allDelivered = stats.pending === 0;
  const pendingTaskIds = building.apartments
    .filter(apt => {
      const tracking = trackingMap.get(apt.taskId);
      return !tracking || tracking.deliveryStatus !== 'delivered';
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
                const isDelivered = tracking?.deliveryStatus === 'delivered';
                const { textiles } = apt;

                // Build textile summary
                const textileItems: string[] = [];
                if (textiles.sheets > 0) textileItems.push(`${textiles.sheets} sáb`);
                if (textiles.sheetsSmall > 0) textileItems.push(`${textiles.sheetsSmall} sáb.peq`);
                if (textiles.sheetsSuite > 0) textileItems.push(`${textiles.sheetsSuite} sáb.suite`);
                if (textiles.pillowCases > 0) textileItems.push(`${textiles.pillowCases} fund`);
                if (textiles.towelsLarge > 0) textileItems.push(`${textiles.towelsLarge} toal.G`);
                if (textiles.towelsSmall > 0) textileItems.push(`${textiles.towelsSmall} toal.P`);
                if (textiles.bathMats > 0) textileItems.push(`${textiles.bathMats} alf`);

                return (
                  <div
                    key={apt.taskId}
                    className={cn(
                      'p-3 rounded-md transition-colors',
                      isDelivered 
                        ? 'bg-green-100 dark:bg-green-900/30' 
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
                        {textileItems.length > 0 && (
                          <p className={cn(
                            'text-sm text-muted-foreground mt-1',
                            isDelivered && 'line-through'
                          )}>
                            {textileItems.join(' · ')}
                          </p>
                        )}
                      </div>
                      {!isDelivered && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDeliver(apt.taskId)}
                          disabled={isUpdating}
                          className="shrink-0"
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          Entregar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Deliver all button */}
            {pendingTaskIds.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="w-full mt-3"
                onClick={() => onDeliverAll(pendingTaskIds)}
                disabled={isUpdating}
              >
                <Truck className="h-4 w-4 mr-2" />
                Entregar todo ({pendingTaskIds.length})
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
