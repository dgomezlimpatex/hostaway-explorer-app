
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ResponsiveCalendarHeaderProps {
  currentDate: Date;
  currentView: 'day' | 'week' | 'month';
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onViewChange: (view: 'day' | 'week' | 'month') => void;
  onNewTask: () => void;
}

export const ResponsiveCalendarHeader = ({
  currentDate,
  currentView,
  onNavigateDate,
  onGoToToday,
  onViewChange,
  onNewTask
}: ResponsiveCalendarHeaderProps) => {
  const formatDate = () => {
    switch (currentView) {
      case 'day':
        return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
      case 'week':
        return format(currentDate, "'Semana del' d 'de' MMMM", { locale: es });
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: es });
      default:
        return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: es });
    }
  };

  return (
    <TooltipProvider>
      <div className="bg-card border-b border-border p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Título y navegación */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                Calendario de Limpieza
              </h1>
            </div>
            
            {/* Navegación de fecha - Responsive */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateDate('prev')}
                      className="transition-all duration-200 hover:scale-105"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only">Anterior</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ir al {currentView === 'day' ? 'día' : currentView === 'week' ? 'semana' : 'mes'} anterior</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onGoToToday}
                      className="px-3 py-1 text-xs md:text-sm font-medium transition-all duration-200 hover:scale-105"
                    >
                      Hoy
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ir a la fecha actual</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateDate('next')}
                      className="transition-all duration-200 hover:scale-105"
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">Siguiente</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ir al {currentView === 'day' ? 'día' : currentView === 'week' ? 'semana' : 'mes'} siguiente</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Fecha actual y controles */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <h2 className="text-base md:text-lg font-semibold text-muted-foreground capitalize">
              {formatDate()}
            </h2>

            <div className="flex items-center gap-2">
              {/* Selectores de vista - Hidden en móvil para ahorrar espacio */}
              <div className="hidden sm:flex items-center gap-1">
                {(['day', 'week', 'month'] as const).map((view) => (
                  <Tooltip key={view}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={currentView === view ? "default" : "outline"}
                        size="sm"
                        onClick={() => onViewChange(view)}
                        className={cn(
                          "text-xs px-2 py-1 transition-all duration-200",
                          currentView === view && "transform scale-105"
                        )}
                      >
                        {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : 'Mes'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Vista {view === 'day' ? 'diaria' : view === 'week' ? 'semanal' : 'mensual'}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* Nueva tarea */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onNewTask}
                    size="sm"
                    className="gap-2 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nueva Tarea</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Crear una nueva tarea</p>
                </TooltipContent>
              </Tooltip>

              {/* Toggle de tema */}
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Vista móvil para selectores de vista */}
        <div className="flex sm:hidden items-center gap-1 mt-3 pt-3 border-t border-border">
          {(['day', 'week', 'month'] as const).map((view) => (
            <Button
              key={view}
              variant={currentView === view ? "default" : "outline"}
              size="sm"
              onClick={() => onViewChange(view)}
              className={cn(
                "flex-1 text-xs transition-all duration-200",
                currentView === view && "transform scale-105"
              )}
            >
              {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : 'Mes'}
            </Button>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};
