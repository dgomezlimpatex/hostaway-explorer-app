import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Package, CheckCircle2, Truck, User } from 'lucide-react';
import { LaundryDeliveryTracking, LaundryDeliveryStatus } from '@/hooks/useLaundryTracking';
import { cn } from '@/lib/utils';

export interface LaundryTask {
  id: string;
  property: string;
  propertyCode?: string;
  address: string;
  date: string;
  serviceTime: string; // start_time - end_time
  cleaner?: string;
  // Textiles
  sheets: number;
  sheetsSmall: number;
  sheetsSuite: number;
  pillowCases: number;
  towelsLarge: number;
  towelsSmall: number;
  bathMats: number;
  // Amenities
  foodKit: number;
  soapLiquid: number;
  showerGel: number;
  shampoo: number;
  conditioner: number;
  toiletPaper: number;
  toiletPaperRolls: number;
  kitchenPaperRolls: number;
  bathroomAmenities: number;
  kitchenAmenities: number;
  // Change status
  changeStatus?: 'new' | 'modified' | 'removed';
}

interface LaundryDeliveryCardProps {
  task: LaundryTask;
  tracking?: LaundryDeliveryTracking;
  shareLinkId: string;
  onStatusUpdate: (taskId: string, status: LaundryDeliveryStatus) => void;
  isUpdating?: boolean;
}

export const LaundryDeliveryCard = ({
  task,
  tracking,
  shareLinkId,
  onStatusUpdate,
  isUpdating,
}: LaundryDeliveryCardProps) => {
  const status = tracking?.status || 'pending';

  const handleStatusClick = (newStatus: LaundryDeliveryStatus) => {
    onStatusUpdate(task.id, newStatus);
  };

  const getChangeStatusBadge = () => {
    switch (task.changeStatus) {
      case 'new':
        return <Badge className="bg-green-500 hover:bg-green-600">🟢 NUEVO</Badge>;
      case 'modified':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">🟡 MODIFICADO</Badge>;
      case 'removed':
        return <Badge variant="destructive">🔴 CANCELADO</Badge>;
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
    }
  };

  // Check if task has any textiles
  const hasTextiles = task.sheets > 0 || task.sheetsSmall > 0 || task.sheetsSuite > 0 || 
    task.pillowCases > 0 || task.towelsLarge > 0 || task.towelsSmall > 0 || task.bathMats > 0;

  // Check if task has any amenities
  const hasAmenities = task.foodKit > 0 || task.soapLiquid > 0 || task.showerGel > 0 ||
    task.shampoo > 0 || task.conditioner > 0 || task.toiletPaper > 0 || 
    task.toiletPaperRolls > 0 || task.kitchenPaperRolls > 0 || 
    task.bathroomAmenities > 0 || task.kitchenAmenities > 0;

  return (
    <Card className={cn(
      "transition-all",
      task.changeStatus === 'removed' && "opacity-60 line-through",
      task.changeStatus === 'new' && "ring-2 ring-green-500",
      task.changeStatus === 'modified' && "ring-2 ring-yellow-500",
      status === 'delivered' && "bg-green-50 dark:bg-green-950/20"
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
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

        {/* Service time and cleaner */}
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

        {/* Textiles */}
        {hasTextiles && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Textiles:</p>
            <div className="flex flex-wrap gap-2">
              {task.sheets > 0 && (
                <Badge variant="outline">Sábanas dobles: {task.sheets}</Badge>
              )}
              {task.sheetsSmall > 0 && (
                <Badge variant="outline">Sábanas indiv: {task.sheetsSmall}</Badge>
              )}
              {task.sheetsSuite > 0 && (
                <Badge variant="outline">Sábanas suite: {task.sheetsSuite}</Badge>
              )}
              {task.pillowCases > 0 && (
                <Badge variant="outline">Fundas almohada: {task.pillowCases}</Badge>
              )}
              {task.towelsLarge > 0 && (
                <Badge variant="outline">Toallas grandes: {task.towelsLarge}</Badge>
              )}
              {task.towelsSmall > 0 && (
                <Badge variant="outline">Toallas pequeñas: {task.towelsSmall}</Badge>
              )}
              {task.bathMats > 0 && (
                <Badge variant="outline">Alfombrines: {task.bathMats}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Amenities */}
        {hasAmenities && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Amenities:</p>
            <div className="flex flex-wrap gap-2">
              {task.foodKit > 0 && (
                <Badge variant="outline">Kit alimentario: {task.foodKit}</Badge>
              )}
              {task.soapLiquid > 0 && (
                <Badge variant="outline">Jabón líquido: {task.soapLiquid}</Badge>
              )}
              {task.showerGel > 0 && (
                <Badge variant="outline">Gel ducha: {task.showerGel}</Badge>
              )}
              {task.shampoo > 0 && (
                <Badge variant="outline">Champú: {task.shampoo}</Badge>
              )}
              {task.conditioner > 0 && (
                <Badge variant="outline">Acondicionador: {task.conditioner}</Badge>
              )}
                {task.toiletPaper > 0 && (
                  <Badge variant="outline">Papel higiénico: {task.toiletPaper}</Badge>
                )}
                {task.toiletPaperRolls > 0 && (
                  <Badge variant="outline">Rollos P. Higiénico: {task.toiletPaperRolls}</Badge>
                )}
                {task.kitchenPaperRolls > 0 && (
                  <Badge variant="outline">Rollos P. Cocina: {task.kitchenPaperRolls}</Badge>
                )}
                {task.bathroomAmenities > 0 && (
                  <Badge variant="outline">Kit baño: {task.bathroomAmenities}</Badge>
                )}
                {task.kitchenAmenities > 0 && (
                  <Badge variant="outline">Kit cocina: {task.kitchenAmenities}</Badge>
                )}
              </div>
            </div>
          )}

        {/* Status info */}
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

        {/* Action buttons - single click */}
        {task.changeStatus !== 'removed' && (
          <div className="flex gap-2 pt-2">
            {status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleStatusClick('prepared')}
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
                onClick={() => handleStatusClick('delivered')}
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
