
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Calendar, Search, History, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TasksPageHeaderProps {
  showPastTasks: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onTogglePastTasks: () => void;
  onOpenCreateModal?: () => void;
  onOpenBatchModal?: () => void;
}

export const TasksPageHeader = ({
  showPastTasks,
  searchTerm,
  onSearchChange,
  onTogglePastTasks,
  onOpenCreateModal,
  onOpenBatchModal,
}: TasksPageHeaderProps) => {
  const { userRole } = useAuth();
  const isCleaner = userRole === 'cleaner';

  return (
    <div className="bg-white border-b shadow-sm">
      <div className="container mx-auto p-6">
        <div className="flex flex-col space-y-4">
          {/* Header with title and back button for cleaners */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {isCleaner && (
                <Link to="/">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                  </Button>
                </Link>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {isCleaner ? 'Mis Tareas' : (showPastTasks ? 'Historial de Tareas' : 'Gestión de Tareas')}
                </h1>
                <p className="text-gray-600 mt-1">
                  {isCleaner 
                    ? 'Visualiza y actualiza tus tareas asignadas'
                    : (showPastTasks 
                      ? 'Consulta el historial completo de tareas completadas' 
                      : 'Gestiona y organiza las tareas de limpieza'
                    )
                  }
                </p>
              </div>
            </div>

            {/* Create buttons - only for non-cleaners */}
            {!isCleaner && !showPastTasks && (
              <div className="flex gap-3">
                <Button onClick={onOpenCreateModal} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva Tarea
                </Button>
                <Button onClick={onOpenBatchModal} variant="outline" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Crear Múltiples
                </Button>
              </div>
            )}
          </div>

          {/* Search and Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Búsqueda y Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* Search Input */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder={isCleaner ? "Buscar en mis tareas..." : "Buscar tareas por propiedad, dirección o limpiador..."}
                      value={searchTerm}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Past Tasks Toggle - only for non-cleaners */}
                {!isCleaner && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="past-tasks"
                      checked={showPastTasks}
                      onCheckedChange={onTogglePastTasks}
                    />
                    <Label htmlFor="past-tasks" className="flex items-center gap-2 cursor-pointer">
                      <History className="h-4 w-4" />
                      Ver Historial
                    </Label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
