
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ChevronLeft, ChevronRight, Calendar, Plus, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ViewType } from "@/types/calendar";
import { Link } from "react-router-dom";
import { useDeviceType } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ResponsiveCalendarHeaderProps {
  currentDate: Date;
  currentView: ViewType;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onViewChange: (view: ViewType) => void;
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
  const { isMobile, isTablet } = useDeviceType();

  const formatDate = () => {
    switch (currentView) {
      case 'day':
        return format(currentDate, isMobile ? "d MMM yyyy" : "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
      case 'three-day':
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 2);
        if (isMobile) {
          return `${format(currentDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM", { locale: es })}`;
        }
        return `${format(currentDate, "d 'de' MMM", { locale: es })} - ${format(endDate, "d 'de' MMM 'de' yyyy", { locale: es })}`;
      case 'week':
        return format(currentDate, isMobile ? "'Sem.' d MMM" : "'Semana del' d 'de' MMMM", { locale: es });
      default:
        return format(currentDate, isMobile ? "d MMM yyyy" : "d 'de' MMMM 'de' yyyy", { locale: es });
    }
  };

  return (
    <div className="bg-card border-b border-border safe-area-top">
      <div className="mobile-container py-3 md:py-6">
        <div className="flex flex-col gap-3 md:gap-4">
          {/* Header principal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {/* Botón de volver */}
              <Link to="/">
                <Button
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  className="flex items-center gap-1 md:gap-2 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {!isMobile && <span>Menú</span>}
                </Button>
              </Link>

              {/* Título */}
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
                <h1 className="text-lg md:text-2xl font-bold text-foreground truncate">
                  {isMobile ? "Calendario" : "Calendario de Limpieza"}
                </h1>
              </div>
            </div>

            {/* Controles de la derecha */}
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              <Button
                onClick={() => {
                  console.log('🔴 ResponsiveCalendarHeader - Nueva Tarea button clicked!');
                  onNewTask();
                }}
                size={isMobile ? "sm" : "default"}
                className="gap-1 md:gap-2"
              >
                <Plus className="h-4 w-4" />
                {!isMobile && <span>Nueva Tarea</span>}
              </Button>
              <ThemeToggle />
            </div>
          </div>

          {/* Fecha actual */}
          <div className="text-center">
            <h2 className="text-sm md:text-lg font-semibold text-muted-foreground capitalize">
              {formatDate()}
            </h2>
          </div>

          {/* Navegación y controles */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Navegación de fecha */}
            <div className="flex items-center justify-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={() => onNavigateDate('prev')}
                className="touch-button"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Anterior</span>
              </Button>

              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={onGoToToday}
                className="px-3 md:px-4 touch-button"
              >
                Hoy
              </Button>

              <Button
                variant="outline"
                size={isMobile ? "sm" : "default"}
                onClick={() => onNavigateDate('next')}
                className="touch-button"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Siguiente</span>
              </Button>
            </div>

            {/* Selectores de vista */}
            <div className="flex items-center justify-center gap-1">
              {(['day', 'three-day', 'week'] as const).map((view) => (
                <Button
                  key={view}
                  variant={currentView === view ? "default" : "outline"}
                  size="sm"
                  onClick={() => onViewChange(view)}
                  className={cn(
                    "text-xs px-2 md:px-3 py-2 transition-all duration-200 touch-button flex-1 sm:flex-initial",
                    currentView === view && "transform scale-105"
                  )}
                >
                  {view === 'day' ? 'Día' : view === 'three-day' ? (isMobile ? '3D' : '3 Días') : 'Semana'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
