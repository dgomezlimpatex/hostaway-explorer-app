
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Calendar, Search, History, ArrowLeft, Home, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BulkAutoAssignButton } from './BulkAutoAssignButton';
import { Task } from '@/types/calendar';
import { useDeviceType } from '@/hooks/use-mobile';

interface TasksPageHeaderProps {
  showPastTasks: boolean;
  searchTerm: string;
  unassignedTasks?: Task[];
  onSearchChange: (value: string) => void;
  onTogglePastTasks: () => void;
  onOpenCreateModal?: () => void;
  onOpenBatchModal?: () => void;
  onAssignmentComplete?: () => void;
}

export const TasksPageHeader = ({
  showPastTasks,
  searchTerm,
  unassignedTasks = [],
  onSearchChange,
  onTogglePastTasks,
  onOpenCreateModal,
  onOpenBatchModal,
  onAssignmentComplete,
}: TasksPageHeaderProps) => {
  const { userRole } = useAuth();
  const { hasPermission, isCleaner, isSupervisor, isAdminOrManager } = useRolePermissions();
  const { isMobile, isTablet } = useDeviceType();
  
  const canCreateTasks = hasPermission('tasks', 'canCreate');
  const canEditTasks = hasPermission('tasks', 'canEdit');

  const getTitle = () => {
    if (isCleaner()) {
      return 'Mis Tareas';
    }
    if (isSupervisor()) {
      return showPastTasks ? 'Historial de Tareas' : 'Supervisión de Tareas';
    }
    return showPastTasks ? 'Historial de Tareas' : 'Gestión de Tareas';
  };

  const getDescription = () => {
    if (isCleaner()) {
      return 'Visualiza y actualiza tus tareas asignadas';
    }
    if (isSupervisor()) {
      return showPastTasks 
        ? 'Consulta el historial completo de tareas completadas' 
        : 'Supervisa las tareas del equipo en tiempo real';
    }
    return showPastTasks 
      ? 'Consulta el historial completo de tareas completadas' 
      : 'Gestiona y organiza las tareas de limpieza';
  };

  return (
    <div className="bg-white border-b shadow-sm">
      <div className="container mx-auto p-3 md:p-6">
        <div className="flex flex-col space-y-3 md:space-y-4">
          {/* Mobile-first header layout */}
          <div className="flex flex-col space-y-3">
            {/* Top row - Always show all buttons in mobile */}
            <div className="flex items-center justify-between gap-2">
              <Link to="/" className="shrink-0">
                <Button variant="outline" size={isMobile ? "sm" : "default"} className="flex items-center gap-1 md:gap-2">
                  <Home className="h-4 w-4" />
                  <span className={isMobile ? "text-xs" : ""}>Menú Principal</span>
                </Button>
              </Link>

              {/* Create buttons container - Always visible for users with permissions */}
              {canCreateTasks && !showPastTasks && onOpenCreateModal && onOpenBatchModal && (
                <div className="flex gap-1 md:gap-3 shrink-0">
                  <Button 
                    onClick={onOpenCreateModal} 
                    size={isMobile ? "sm" : "default"}
                    className="flex items-center gap-1 md:gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span className={isMobile ? "text-xs" : ""}>Nueva Tarea</span>
                  </Button>
                  <Button 
                    onClick={onOpenBatchModal} 
                    variant="outline" 
                    size={isMobile ? "sm" : "default"}
                    className="flex items-center gap-1 md:gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    <span className={isMobile ? "text-xs" : ""}>Múltiples</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Title section */}
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center gap-2">
                <h1 className={`font-bold text-gray-900 flex items-center gap-2 ${
                  isMobile ? 'text-xl' : 'text-3xl'
                }`}>
                  {getTitle()}
                  {isSupervisor() && <Eye className={`text-blue-600 ${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />}
                </h1>
              </div>
              
              <p className={`text-gray-600 ${isMobile ? 'text-sm' : ''}`}>
                {getDescription()}
              </p>
              
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800 ${
                  isMobile ? 'text-xs' : 'text-xs'
                }`}>
                  {userRole?.charAt(0).toUpperCase()}{userRole?.slice(1)}
                </span>
                {isSupervisor() && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-800 ${
                    isMobile ? 'text-xs' : 'text-xs'
                  }`}>
                    Solo lectura
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Search and Controls Card */}
          <Card>
            <CardHeader className={isMobile ? 'pb-3' : ''}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
                <Search className="h-4 w-4 md:h-5 md:w-5" />
                Búsqueda y Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className={isMobile ? 'pt-0' : ''}>
              <div className="flex flex-col gap-3 md:gap-4">
                {/* Search Input */}
                <div className="w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder={isCleaner() ? "Buscar en mis tareas..." : "Buscar tareas por propiedad, dirección o limpiador..."}
                      value={searchTerm}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className={`pl-10 ${isMobile ? 'h-12 text-base' : ''}`}
                    />
                  </div>
                </div>

                {/* Controls Row */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  {/* Bulk Auto Assign Button */}
                  {canEditTasks && !showPastTasks && onAssignmentComplete && (
                    <div className="order-2 sm:order-1">
                      <BulkAutoAssignButton 
                        unassignedTasks={unassignedTasks}
                        onAssignmentComplete={onAssignmentComplete}
                      />
                    </div>
                  )}

                  {/* Past Tasks Toggle */}
                  {!isCleaner() && (
                    <div className="flex items-center space-x-2 order-1 sm:order-2">
                      <Switch
                        id="past-tasks"
                        checked={showPastTasks}
                        onCheckedChange={onTogglePastTasks}
                      />
                      <Label htmlFor="past-tasks" className="flex items-center gap-2 cursor-pointer">
                        <History className="h-4 w-4" />
                        <span className={isMobile ? 'text-sm' : ''}>Ver Historial</span>
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
