
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePropertyGroups } from '@/hooks/usePropertyGroups';
import { PropertyGroupModal } from './PropertyGroupModal';
import { PropertyGroupDetails } from './PropertyGroupDetails';
import { PropertyGroup } from '@/types/propertyGroups';
import { Plus, Building2, Clock, Users, Settings } from 'lucide-react';

export const PropertyGroupsPage = () => {
  const [selectedGroup, setSelectedGroup] = useState<PropertyGroup | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: propertyGroups, isLoading } = usePropertyGroups();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Cargando grupos de propiedades...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Sistema de Asignación Automática
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona grupos de propiedades y asignaciones automáticas de personal
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Crear Grupo
        </Button>
      </div>

      {/* Statistics Cards */}
      {propertyGroups && propertyGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Grupos</p>
                  <p className="text-2xl font-bold">{propertyGroups.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Grupos Activos</p>
                  <p className="text-2xl font-bold">
                    {propertyGroups.filter(g => g.isActive).length}
                  </p>
                </div>
                <Settings className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Auto-Asignación</p>
                  <p className="text-2xl font-bold">
                    {propertyGroups.filter(g => g.autoAssignEnabled).length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ventana Promedio</p>
                  <p className="text-2xl font-bold">6h</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Grupos de Propiedades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!propertyGroups || propertyGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay grupos configurados</p>
                  <p className="text-sm">Crea tu primer grupo para comenzar</p>
                </div>
              ) : (
                propertyGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedGroup?.id === group.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedGroup(group)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900">{group.name}</h3>
                      <div className="flex gap-1">
                        {group.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Activo</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">Inactivo</Badge>
                        )}
                        {group.autoAssignEnabled && (
                          <Badge className="bg-blue-100 text-blue-800">Auto</Badge>
                        )}
                      </div>
                    </div>
                    
                    {group.description && (
                      <p className="text-sm text-gray-600 mb-2">{group.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Check-out: {group.checkOutTime}</span>
                      <span>Check-in: {group.checkInTime}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Group Details */}
        <div className="lg:col-span-2">
          {selectedGroup ? (
            <PropertyGroupDetails
              group={selectedGroup}
              onEdit={() => setIsEditModalOpen(true)}
              onUpdate={() => setSelectedGroup(null)}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold mb-2">Selecciona un grupo</h3>
                <p>Elige un grupo de la lista para ver sus detalles y configuración</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      <PropertyGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        group={null}
      />

      {selectedGroup && (
        <PropertyGroupModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          group={selectedGroup}
        />
      )}
    </div>
  );
};
