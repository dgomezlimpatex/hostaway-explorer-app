import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, Clock, Package, CheckCircle2, Truck, User, FileText, ChevronDown } from 'lucide-react';
import { LaundryDeliveryTracking, LaundryDeliveryStatus } from '@/hooks/useLaundryTracking';
import { cn } from '@/lib/utils';
import type { LaundryStockConsumable } from '@/services/laundryScheduleService';

export interface LaundryTask {
  id: string;
  property: string;
  propertyCode?: string;
  address: string;
  date: string;
  serviceTime: string;
  cleaner?: string;
  propertyNotes?: string;
  sheets: number;
  sheetsSmall: number;
  sheetsSuite: number;
  pillowCases: number;
  towelsLarge: number;
  towelsSmall: number;
  bathMats: number;
  foodKit: number;
  soapLiquid: number;
  showerGel: number;
  shampoo: number;
  conditioner: number;
  toiletPaper: number;
  toiletPaperRolls: number;
  kitchenPaperRolls: number;
  kitchenCloths: number;
  bathroomAmenities: number;
  kitchenAmenities: number;
  stockConsumables?: LaundryStockConsumable[];
  changeStatus?: 'new' | 'modified' | 'removed';
}

interface LaundryDeliveryCardProps {
  task: LaundryTask;
  tracking?: LaundryDeliveryTracking;
  shareLinkId: string;
  onStatusUpdate: (taskId: string, status: LaundryDeliveryStatus) => void;
  isUpdating?: boolean;
}

const QuantityBadge = ({ label, quantity }: { label: string; quantity: number }) => (
  quantity > 0 ? <Badge variant="outline">{label.toUpperCase()}: {quantity}</Badge> : null
);

const normalizeItemName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const hasKitchenClothStockItem = (items: LaundryStockConsumable[] = []) =>
  items.some((item) => {
    const name = normalizeItemName(item.name);
    return name.includes('cocina') && (name.includes('pano') || name.includes('bayeta'));
  });

export const LaundryDeliveryCard = ({
  task,
  tracking,
  onStatusUpdate,
  isUpdating,
}: LaundryDeliveryCardProps) => {
  const status = tracking?.status || 'pending';
  const [notesOpen, setNotesOpen] = useState(false);

  const getChangeStatusBadge = () => {
    switch (task.changeStatus) {
      case 'new':
        return <Badge className="bg-green-500 hover:bg-green-600">NUEVO</Badge>;
      case 'modified':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">MODIFICADO</Badge>;
      case 'removed':
        return <Badge variant="destructive">CANCELADO</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'prepared':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Preparada</Badge>;
      case 'delivered':
        return <Badge className="bg-green-600 hover:bg-green-700">Entregada</Badge>;
      default:
        return null;
    }
  };

  const hasTextiles = task.sheets > 0 || task.sheetsSmall > 0 || task.sheetsSuite > 0 ||
    task.pillowCases > 0 || task.towelsLarge > 0 || task.towelsSmall > 0 || task.bathMats > 0;

  const hasLegacyAmenities = task.foodKit > 0 || task.soapLiquid > 0 || task.showerGel > 0 ||
    task.shampoo > 0 || task.conditioner > 0 || task.toiletPaper > 0 ||
    task.toiletPaperRolls > 0 || task.kitchenPaperRolls > 0 ||
    task.kitchenCloths > 0 || task.bathroomAmenities > 0 || task.kitchenAmenities > 0;

  const hasStockConsumables = !!task.stockConsumables?.length;
  const kitchenClothsQuantity = task.kitchenCloths > 0 ? task.kitchenCloths : 1;
  const shouldShowKitchenCloths = !hasKitchenClothStockItem(task.stockConsumables);
  const hasAmenities = hasStockConsumables || hasLegacyAmenities || shouldShowKitchenCloths;

  return (
    <Card className={cn(
      'transition-all',
      task.changeStatus === 'removed' && 'opacity-60 line-through',
      task.changeStatus === 'new' && 'ring-2 ring-green-500',
      task.changeStatus === 'modified' && 'ring-2 ring-yellow-500',
      status === 'delivered' && 'bg-green-50 dark:bg-green-950/20'
    )}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg truncate">
                {task.propertyCode || task.property}
              </h3>
              {getChangeStatusBadge()}
              {getStatusBadge()}
            </div>
            {task.propertyCode && task.property !== task.propertyCode && (
              <p className="text-sm text-muted-foreground truncate">{task.property}</p>
            )}
            <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.address}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Servicio: {task.serviceTime}</span>
          </div>
          {task.cleaner && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{task.cleaner}</span>
            </div>
          )}
        </div>

        {hasTextiles && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Textiles:</p>
            <div className="flex flex-wrap gap-2">
              <QuantityBadge label="Sabanas" quantity={task.sheets} />
              <QuantityBadge label="Sabanas pequenas" quantity={task.sheetsSmall} />
              <QuantityBadge label="Sabanas suite" quantity={task.sheetsSuite} />
              <QuantityBadge label="Fundas almohada" quantity={task.pillowCases} />
              <QuantityBadge label="Toallas grandes" quantity={task.towelsLarge} />
              <QuantityBadge label="Toallas pequenas" quantity={task.towelsSmall} />
              <QuantityBadge label="Alfombrines" quantity={task.bathMats} />
            </div>
          </div>
        )}

        {hasAmenities && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Amenities y consumibles:</p>
            <div className="flex flex-wrap gap-2">
              {hasStockConsumables ? (
                task.stockConsumables!.map((item) => (
                  <Badge key={item.productId} variant="outline">
                    {item.name.toUpperCase()}: {item.quantity}
                  </Badge>
                ))
              ) : (
                <>
                  <QuantityBadge label="Kit alimentario" quantity={task.foodKit} />
                  <QuantityBadge label="Jabon liquido" quantity={task.soapLiquid} />
                  <QuantityBadge label="Gel ducha" quantity={task.showerGel} />
                  <QuantityBadge label="Champu" quantity={task.shampoo} />
                  <QuantityBadge label="Acondicionador" quantity={task.conditioner} />
                  <QuantityBadge label="Papel higienico" quantity={task.toiletPaper} />
                  <QuantityBadge label="Rollos P. Higienico" quantity={task.toiletPaperRolls} />
                  <QuantityBadge label="Rollos P. Cocina" quantity={task.kitchenPaperRolls} />
                  <QuantityBadge label="Kit bano" quantity={task.bathroomAmenities} />
                  <QuantityBadge label="Kit cocina" quantity={task.kitchenAmenities} />
                </>
              )}
              {shouldShowKitchenCloths && (
                <QuantityBadge label="Paños de cocina" quantity={kitchenClothsQuantity} />
              )}
            </div>
          </div>
        )}

        {task.propertyNotes && (
          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notas del apartamento
                </span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', notesOpen && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 rounded-md bg-muted/50 text-sm whitespace-pre-wrap">
                {task.propertyNotes}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {tracking && status !== 'pending' && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            {tracking.preparedByName && (
              <p>Preparada por: {tracking.preparedByName} - {new Date(tracking.preparedAt!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
            )}
            {tracking.deliveredByName && (
              <p>Entregada por: {tracking.deliveredByName} - {new Date(tracking.deliveredAt!).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
            )}
            {tracking.notes && <p className="italic mt-1">Nota: {tracking.notes}</p>}
          </div>
        )}

        {task.changeStatus !== 'removed' && (
          <div className="flex gap-2 pt-2">
            {status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onStatusUpdate(task.id, 'prepared')}
                disabled={isUpdating}
              >
                <Package className="h-4 w-4 mr-2" />
                Marcar Preparada
              </Button>
            )}
            {(status === 'pending' || status === 'prepared') && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onStatusUpdate(task.id, 'delivered')}
                disabled={isUpdating}
              >
                <Truck className="h-4 w-4 mr-2" />
                Marcar Entregada
              </Button>
            )}
            {status === 'delivered' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Completada</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
