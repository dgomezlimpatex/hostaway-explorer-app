import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, TrendingUp, TrendingDown, RotateCcw, Zap, Package, Eye } from "lucide-react";
import { InventoryMovementWithDetails } from '@/types/inventory';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreateMovementDialog } from './CreateMovementDialog';

interface MovementsTableProps {
  movements: InventoryMovementWithDetails[];
  onCreateMovement: () => void;
}

export function MovementsTable({ movements, onCreateMovement }: MovementsTableProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'entrada':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'salida':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'ajuste':
        return <RotateCcw className="h-4 w-4 text-blue-600" />;
      case 'consumo_automatico':
        return <Zap className="h-4 w-4 text-orange-600" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'entrada':
        return 'Entrada';
      case 'salida':
        return 'Salida';
      case 'ajuste':
        return 'Ajuste';
      case 'consumo_automatico':
        return 'Consumo Automático';
      default:
        return type;
    }
  };

  const getMovementVariant = (type: string) => {
    switch (type) {
      case 'entrada':
        return 'default';
      case 'salida':
        return 'destructive';
      case 'ajuste':
        return 'outline';
      case 'consumo_automatico':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleCreateMovement = () => {
    setShowCreateDialog(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Movimientos de Inventario
          </CardTitle>
          <Button onClick={handleCreateMovement}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Movimiento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {movements.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay movimientos</h3>
            <p className="text-muted-foreground mb-4">
              Los movimientos de inventario aparecerán aquí cuando se registren entradas, salidas o ajustes.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Stock Anterior</TableHead>
                <TableHead>Stock Nuevo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>
                    {format(new Date(movement.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{movement.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {movement.product.category.name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getMovementVariant(movement.movement_type)} className="flex items-center gap-1 w-fit">
                      {getMovementIcon(movement.movement_type)}
                      {getMovementTypeLabel(movement.movement_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${
                      movement.movement_type === 'entrada' ? 'text-green-600' : 
                      movement.movement_type === 'salida' ? 'text-red-600' : 
                      'text-blue-600'
                    }`}>
                      {movement.movement_type === 'entrada' ? '+' : movement.movement_type === 'salida' ? '-' : '±'}
                      {movement.quantity} {movement.product.unit_of_measure}
                    </span>
                  </TableCell>
                  <TableCell>
                    {movement.previous_quantity} {movement.product.unit_of_measure}
                  </TableCell>
                  <TableCell>
                    {movement.new_quantity} {movement.product.unit_of_measure}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm max-w-[200px] truncate" title={movement.reason}>
                      {movement.reason}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <CreateMovementDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onMovementCreated={onCreateMovement}
        />
      </CardContent>
    </Card>
  );
}