import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Building2, ChevronDown, ChevronRight, Package, CheckCircle2, User, Calendar } from 'lucide-react';
import { BuildingGroup, LaundryApartment } from '@/services/laundryScheduleService';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface BuildingCollectionGroupProps {
  building: BuildingGroup;
  trackingMap: Map<string, { collectionStatus: string; deliveryStatus: string }>;
  onCollect: (taskId: string) => void;
  onCollectAll: (taskIds: string[]) => void;
  isUpdating: boolean;
}

export const BuildingCollectionGroup = ({
  building,
  trackingMap,
  onCollect,
  onCollectAll,
  isUpdating,
}: BuildingCollectionGroupProps) => {
  const [isOpen, setIsOpen] = useState(true);

  // Calculate stats for this building
  const stats = building.apartments.reduce(
    (acc, apt) => {
      const tracking = trackingMap.get(apt.taskId);
      const status = tracking?.collectionStatus || 'pending';
      if (status === 'collected') {
        acc.collected++;
      } else {
        acc.pending++;
      }
      return acc;
    },
    { collected: 0, pending: 0 }
  );

  const allCollected = stats.pending === 0;
  const pendingTaskIds = building.apartments
    .filter(apt => {
      const tracking = trackingMap.get(apt.taskId);
      return !tracking || tracking.collectionStatus === 'pending';
    })
    .map(apt => apt.taskId);

  return (
    <Card className={cn(
      'transition-all',
      allCollected && 'bg-green-50 dark:bg-green-950/20 border-green-200'
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
                {allCollected ? (
                  <Badge className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Recogido
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    {stats.collected}/{building.totalApartments}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            {/* Apartment list */}
            <div className="space-y-2">
              {building.apartments.map(apt => {
                const tracking = trackingMap.get(apt.taskId);
                const isCollected = tracking?.collectionStatus === 'collected';

                return (
                  <div
                    key={apt.taskId}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-md transition-colors',
                      isCollected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted/30 hover:bg-muted/50'
                    )}
                  >
                    <Checkbox
                      checked={isCollected}
                      onCheckedChange={() => !isCollected && onCollect(apt.taskId)}
                      disabled={isUpdating || isCollected}
                      className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        'font-medium',
                        isCollected && 'line-through text-muted-foreground'
                      )}>
                        {apt.propertyCode}
                      </span>
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
                    </div>
                    {isCollected && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Collect all button */}
            {pendingTaskIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => onCollectAll(pendingTaskIds)}
                disabled={isUpdating}
              >
                <Package className="h-4 w-4 mr-2" />
                Marcar todo recogido ({pendingTaskIds.length})
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
