
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, Settings, User, Moon, Plus } from "lucide-react";

interface CalendarHeaderProps {
  currentDate: Date;
  currentView: 'day' | 'three-day' | 'week';
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onViewChange: (view: 'day' | 'three-day' | 'week') => void;
  onNewTask: () => void;
}

export const CalendarHeader = ({
  currentDate,
  currentView,
  onNavigateDate,
  onGoToToday,
  onViewChange,
  onNewTask
}: CalendarHeaderProps) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  const getDateRange = () => {
    if (currentView === 'day') {
      return formatDate(currentDate);
    } else if (currentView === 'three-day') {
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 2);
      return `${currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🏠 Gestión de Limpiezas
          </h1>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Sistema Optimizado
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input 
              placeholder="Buscar tareas..." 
              className="pl-10 w-64"
            />
          </div>
          
          {/* Action buttons */}
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <User className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Moon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onNavigateDate('prev')}
              className="hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="min-w-[300px] text-center">
              <span className="text-lg font-semibold text-gray-900 capitalize">
                {getDateRange()}
              </span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onNavigateDate('next')}
              className="hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button 
            size="sm" 
            variant="outline"
            onClick={onGoToToday}
            className="hover:bg-gray-50"
          >
            Hoy
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {/* View selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['day', 'three-day', 'week'] as const).map((view) => (
              <Button
                key={view}
                size="sm"
                variant={currentView === view ? "default" : "ghost"}
                onClick={() => onViewChange(view)}
                className={`px-3 py-1 text-xs ${
                  currentView === view 
                    ? "bg-white shadow-sm" 
                    : "hover:bg-gray-200"
                }`}
              >
                {view === 'day' ? 'Día' : view === 'three-day' ? '3 Días' : 'Semana'}
              </Button>
            ))}
          </div>

          {/* New task button */}
          <Button 
            size="sm" 
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={onNewTask}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        </div>
      </div>
    </div>
  );
};
