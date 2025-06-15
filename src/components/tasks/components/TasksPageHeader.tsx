
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowLeft, Users, History } from "lucide-react";
import { Link } from "react-router-dom";

interface TasksPageHeaderProps {
  showPastTasks: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onTogglePastTasks: () => void;
  onOpenCreateModal: () => void;
  onOpenBatchModal: () => void;
}

export const TasksPageHeader = ({
  showPastTasks,
  searchTerm,
  onSearchChange,
  onTogglePastTasks,
  onOpenCreateModal,
  onOpenBatchModal,
}: TasksPageHeaderProps) => {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Menú
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {showPastTasks ? 'Tareas Pasadas' : 'Gestión de Tareas'}
            </h1>
            <p className="text-gray-600">
              {showPastTasks 
                ? 'Historial de tareas completadas y pasadas' 
                : 'Administra y supervisa todas las tareas de limpieza'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle Past Tasks Button */}
          <Button 
            onClick={onTogglePastTasks}
            variant="outline"
            className="flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            {showPastTasks ? 'Ver Tareas Actuales' : 'Ver Tareas Pasadas'}
          </Button>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input 
              placeholder="Buscar tareas..." 
              value={searchTerm} 
              onChange={e => onSearchChange(e.target.value)} 
              className="pl-10 w-64" 
            />
          </div>
          
          {!showPastTasks && (
            <>
              <Button 
                onClick={onOpenBatchModal} 
                variant="outline" 
                className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Users className="h-4 w-4" />
                Crear Múltiples
              </Button>
              <Button onClick={onOpenCreateModal} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva Tarea
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
