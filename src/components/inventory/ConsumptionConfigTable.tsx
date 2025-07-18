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
import { Edit, Plus, MapPin, Package } from "lucide-react";
import { PropertyConsumptionWithDetails } from '@/types/inventory';
import { CreateConsumptionConfigDialog } from './CreateConsumptionConfigDialog';
import { EditConsumptionConfigDialog } from './EditConsumptionConfigDialog';

interface ConsumptionConfigTableProps {
  configs: PropertyConsumptionWithDetails[];
  onCreateConfig: () => void;
  onEditConfig: (config: PropertyConsumptionWithDetails) => void;
}

export function ConsumptionConfigTable({ 
  configs, 
  onCreateConfig, 
  onEditConfig 
}: ConsumptionConfigTableProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PropertyConsumptionWithDetails | null>(null);

  const handleCreateConfig = () => {
    setShowCreateDialog(true);
  };

  const handleEditConfig = (config: PropertyConsumptionWithDetails) => {
    setEditingConfig(config);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Configuración de Consumo por Propiedad
          </CardTitle>
          <Button onClick={handleCreateConfig}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Configuración
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {configs.length === 0 ? (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay configuraciones</h3>
            <p className="text-muted-foreground mb-4">
              Crea configuraciones de consumo para automatizar el control de inventario por propiedad.
            </p>
            <Button onClick={handleCreateConfig}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Configuración
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Cantidad por Limpieza</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">
                    {config.property?.nombre || 'Propiedad sin nombre'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {config.product.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {config.product.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {config.quantity_per_cleaning} {config.product.unit_of_measure}
                  </TableCell>
                  <TableCell>
                    <Badge variant={config.is_active ? "default" : "secondary"}>
                      {config.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditConfig(config)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <CreateConsumptionConfigDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onConfigCreated={onCreateConfig}
        />

        <EditConsumptionConfigDialog
          config={editingConfig}
          open={!!editingConfig}
          onOpenChange={(open) => !open && setEditingConfig(null)}
          onConfigUpdated={onEditConfig}
        />
      </CardContent>
    </Card>
  );
}