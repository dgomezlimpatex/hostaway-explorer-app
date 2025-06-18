
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePropertyGroups } from '@/hooks/usePropertyGroups';
import { PropertyGroupModal } from './PropertyGroupModal';
import { PropertyGroupDetails } from './PropertyGroupDetails';
import { PropertyGroup } from '@/types/propertyGroups';
import { Plus, Building2, Clock, Users, Settings, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Sistema de Asignación Automática
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Gestiona grupos de propiedades y asignaciones automáticas de personal
                </p>
              </div>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Crear Grupo
            </Button>
          </div>

          {/* Statistics Cards */}
          {propertyGroups && propertyGroups.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Total Grupos</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{propertyGroups.length}</p>
                    </div>
                    <Building2 className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Grupos Activos</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {propertyGroups.filter(g => g.isActive).length}
                      </p>
                    </div>
                    <Settings className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Auto-Asignación</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {propertyGroups.filter(g => g.autoAssignEnabled).length}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Ventana Promedio</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">6h</p>
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
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Grupos de Propiedades</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!propertyGroups || propertyGroups.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                      <p>No hay grupos configurados</p>
                      <p className="text-sm">Crea tu primer grupo para comenzar</p>
                    </div>
                  ) : (
                    propertyGroups.map((group) => (
                      <div
                        key={group.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedGroup?.id === group.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                        }`}
                        onClick={() => setSelectedGroup(group)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                          <div className="flex gap-1">
                            {group.isActive ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Activo</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">Inactivo</Badge>
                            )}
                            {group.autoAssignEnabled && (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">Auto</Badge>
                            )}
                          </div>
                        </div>
                        
                        {group.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{group.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
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
      </div>
    </div>
  );
};
