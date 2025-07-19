import { useState } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAmenityMappings, useCreateAmenityMapping, useDeleteAmenityMapping } from '@/hooks/useAmenityMappings';
import { useInventoryProducts } from '@/hooks/useInventory';

const AMENITY_FIELDS = {
  numero_sabanas: 'Sábanas',
  numero_toallas_grandes: 'Toallas Grandes',
  numero_toallas_pequenas: 'Toallas Pequeñas',
  numero_alfombrines: 'Alfombrines',
  numero_fundas_almohada: 'Fundas de Almohada',
  kit_alimentario: 'Kit Alimentario'
};

export function AmenityMappingTable() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  const { data: mappings = [], isLoading } = useAmenityMappings();
  const { data: products = [] } = useInventoryProducts();
  const createMapping = useCreateAmenityMapping();
  const deleteMapping = useDeleteAmenityMapping();

  const handleCreateMapping = () => {
    if (!selectedAmenity || !selectedProduct) return;

    createMapping.mutate({
      amenity_field: selectedAmenity,
      product_id: selectedProduct,
    }, {
      onSuccess: () => {
        setShowCreateDialog(false);
        setSelectedAmenity('');
        setSelectedProduct('');
      }
    });
  };

  const handleDeleteMapping = (id: string) => {
    deleteMapping.mutate(id);
  };

  // Filtrar amenities que ya están mapeados
  const availableAmenities = Object.entries(AMENITY_FIELDS).filter(
    ([field]) => !mappings.some(mapping => mapping.amenity_field === field)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Mapeo de Amenities a Inventario
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Mapeo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Mapeo de Amenity</DialogTitle>
                <DialogDescription>
                  Configura qué producto de inventario corresponde a cada amenity de las propiedades.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="amenity">Amenity de Propiedad</Label>
                  <Select value={selectedAmenity} onValueChange={setSelectedAmenity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un amenity" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAmenities.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product">Producto de Inventario</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {product.category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateMapping}
                    disabled={!selectedAmenity || !selectedProduct || createMapping.isPending}
                  >
                    Crear Mapeo
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="text-center py-8">
            <Settings className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay mapeos configurados</h3>
            <p className="text-muted-foreground mb-4">
              Configura qué productos de inventario corresponden a los amenities de las propiedades.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primer Mapeo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <Badge variant="outline" className="mb-1">
                      {AMENITY_FIELDS[mapping.amenity_field as keyof typeof AMENITY_FIELDS]}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Amenity de propiedad
                    </p>
                  </div>
                  <div className="text-muted-foreground">→</div>
                  <div>
                    <p className="font-medium">{mapping.product?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {mapping.product?.category?.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteMapping(mapping.id)}
                  disabled={deleteMapping.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">¿Cómo funciona?</h4>
          <p className="text-sm text-blue-700">
            Cuando se complete una tarea de limpieza, el sistema automáticamente descontará del inventario 
            las cantidades configuradas en cada propiedad (sábanas, toallas, etc.) según estos mapeos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}