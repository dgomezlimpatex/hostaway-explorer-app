
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAssignPropertyToGroup } from '@/hooks/usePropertyGroups';
import { PropertyGroup, PropertyGroupAssignment } from '@/types/propertyGroups';
import { Property } from '@/types/property';
import { Plus, Building, MapPin, Trash2 } from 'lucide-react';
import { propertyGroupStorage } from '@/services/storage/propertyGroupStorage';
import { toast } from '@/hooks/use-toast';

interface PropertyAssignmentSectionProps {
  group: PropertyGroup;
  assignedProperties: Property[];
  allProperties: Property[];
  propertyAssignments: PropertyGroupAssignment[];
}

export const PropertyAssignmentSection = ({ 
  group, 
  assignedProperties, 
  allProperties, 
  propertyAssignments 
}: PropertyAssignmentSectionProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  const assignProperty = useAssignPropertyToGroup();

  const availableProperties = allProperties.filter(p => 
    !propertyAssignments.some(pa => pa.propertyId === p.id)
  );

  const handleAddProperties = async () => {
    try {
      for (const propertyId of selectedProperties) {
        await assignProperty.mutateAsync({ groupId: group.id, propertyId });
      }
      setSelectedProperties([]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding properties:', error);
    }
  };

  const handleRemoveProperty = async (assignmentId: string) => {
    try {
      await propertyGroupStorage.removePropertyFromGroup(assignmentId);
      toast({
        title: "Propiedad eliminada",
        description: "La propiedad se ha eliminado del grupo correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la propiedad del grupo.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Propiedades Asignadas</h3>
        <Button onClick={() => setIsAddModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Añadir Propiedades
        </Button>
      </div>

      {assignedProperties.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay propiedades asignadas a este grupo</p>
            <p className="text-sm">Añade propiedades para comenzar con la asignación automática</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignedProperties.map((property) => {
            const assignment = propertyAssignments.find(pa => pa.propertyId === property.id);
            return (
              <Card key={property.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900">{property.nombre}</h4>
                      <p className="text-sm text-gray-600">{property.codigo}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => assignment && handleRemoveProperty(assignment.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <MapPin className="h-3 w-3" />
                    <span>{property.direccion}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Badge className="bg-blue-100 text-blue-800">
                      {property.duracionServicio}min
                    </Badge>
                    <Badge className="bg-green-100 text-green-800">
                      €{property.costeServicio}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Properties Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Añadir Propiedades al Grupo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {availableProperties.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No hay propiedades disponibles para asignar
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {availableProperties.map((property) => (
                  <div key={property.id} className="flex items-center space-x-3 p-2 border rounded">
                    <Checkbox
                      id={property.id}
                      checked={selectedProperties.includes(property.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedProperties([...selectedProperties, property.id]);
                        } else {
                          setSelectedProperties(selectedProperties.filter(id => id !== property.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{property.nombre}</p>
                      <p className="text-sm text-gray-600">{property.codigo} - {property.direccion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddProperties}
                disabled={selectedProperties.length === 0 || assignProperty.isPending}
              >
                Añadir ({selectedProperties.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
