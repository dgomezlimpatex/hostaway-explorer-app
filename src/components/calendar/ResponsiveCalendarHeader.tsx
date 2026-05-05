import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, ArrowLeft, Users, Sparkles, Search, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ViewType } from "@/types/calendar";
import { Link } from "react-router-dom";
import { useDeviceType } from "@/hooks/use-mobile";

interface ResponsiveCalendarHeaderProps {
  currentDate: Date;
  currentView: ViewType;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onViewChange: (view: ViewType) => void;
  onNewTask: () => void;
  onNewBatchTask?: () => void;
  onNewExtraordinaryService?: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  showSearch?: boolean;
  searchResultsLabel?: string;
  clientFilterOptions?: Array<{ id: string; name: string }>;
  cleanerFilterOptions?: Array<{ id: string; name: string }>;
  selectedClientFilter?: string;
  selectedCleanerFilter?: string;
  onClientFilterChange?: (value: string) => void;
  onCleanerFilterChange?: (value: string) => void;
}

export const ResponsiveCalendarHeader = ({
  currentDate,
  currentView,
  onNavigateDate,
  onGoToToday,
  onViewChange,
  onNewTask,
  onNewBatchTask,
  onNewExtraordinaryService,
  searchTerm = '',
  onSearchChange,
  showSearch = false,
  searchResultsLabel,
  clientFilterOptions = [],
  cleanerFilterOptions = [],
  selectedClientFilter = 'all',
  selectedCleanerFilter = 'all',
  onClientFilterChange,
  onCleanerFilterChange,
}: ResponsiveCalendarHeaderProps) => {
  const { isMobile } = useDeviceType();

  const formatDate = () => {
    switch (currentView) {
      case 'day':
        return format(currentDate, isMobile ? "EEE d MMM" : "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
      case 'three-day': {
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 2);
        if (isMobile) {
          return `${format(currentDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM", { locale: es })}`;
        }
        return `${format(currentDate, "d 'de' MMM", { locale: es })} - ${format(endDate, "d 'de' MMM 'de' yyyy", { locale: es })}`;
      }
      case 'week':
        return format(currentDate, isMobile ? "'Sem.' d MMM" : "'Semana del' d 'de' MMMM", { locale: es });
      default:
        return format(currentDate, isMobile ? "d MMM yyyy" : "d 'de' MMMM 'de' yyyy", { locale: es });
    }
  };

  const todayDayNumber = format(new Date(), 'd');

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-border/40">
      {/* ===== TOP BAR: gradiente morado ===== */}
      <div className="bg-gradient-to-r from-[hsl(258,70%,28%)] via-[hsl(262,65%,32%)] to-[hsl(268,60%,38%)] text-white px-3 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Izquierda: back + logo + título + chip fecha hoy */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <Link to="/" className="shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15 hover:text-white h-9 w-9 md:h-10 md:w-10 rounded-xl"
                aria-label="Volver al menú"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            {/* Logo box */}
            <div className="hidden sm:flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/15 backdrop-blur-sm font-bold text-sm md:text-base shrink-0">
              LX
            </div>

            {/* Chip "Hoy día N" */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/15 backdrop-blur-sm shrink-0">
              <CalendarDays className="h-4 w-4" />
              <span className="text-sm font-semibold">{todayDayNumber}</span>
            </div>

            {/* Título */}
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-bold truncate leading-tight">
                {isMobile ? "Calendario" : "Calendario de Limpieza"}
              </h1>
              <p className="text-[11px] md:text-xs text-white/70 capitalize truncate">
                {formatDate()}
              </p>
            </div>
          </div>

          {/* Derecha: acciones */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {onNewBatchTask && (
              <Button
                onClick={onNewBatchTask}
                size={isMobile ? "sm" : "default"}
                className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm rounded-xl"
              >
                <Users className="h-4 w-4" />
                {!isMobile && <span>Múltiples</span>}
              </Button>
            )}
            <Button
              onClick={onNewTask}
              size={isMobile ? "sm" : "default"}
              className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm rounded-xl"
            >
              <Plus className="h-4 w-4" />
              {!isMobile && <span>Nueva Tarea</span>}
            </Button>
            {onNewExtraordinaryService && (
              <Button
                onClick={onNewExtraordinaryService}
                size={isMobile ? "sm" : "default"}
                className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border-0 rounded-xl shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                {!isMobile && <span>Servicio Extra</span>}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ===== SUBHEADER: navegación + selector vista ===== */}
      <div className="bg-card border-t border-border/40 px-3 md:px-6 py-2.5 md:py-3">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Navegación centrada */}
          <div className="flex items-center gap-1 md:gap-2 flex-1 justify-center md:justify-start">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onNavigateDate('prev')}
              className="h-9 w-9 rounded-lg"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onGoToToday}
              className="px-4 h-9 rounded-lg font-medium"
            >
              Hoy
            </Button>

            <span className="hidden md:inline text-sm font-semibold text-foreground capitalize px-3">
              {formatDate()}
            </span>

            <Button
              variant="outline"
              size="icon"
              onClick={() => onNavigateDate('next')}
              className="h-9 w-9 rounded-lg"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Selector de vista (segmented control) */}
          <div className="flex items-center bg-muted rounded-lg p-1 shrink-0">
            {(['day', 'three-day', 'week'] as const).map((view) => (
              <button
                key={view}
                onClick={() => onViewChange(view)}
                className={cn(
                  "px-2.5 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all",
                  currentView === view
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {view === 'day' ? 'Día' : view === 'three-day' ? (isMobile ? '3D' : '3 Días') : 'Semana'}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros (solo admin): desplegables cliente/empleado + buscador pequeño */}
        {showSearch && onSearchChange && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {onClientFilterChange && (
              <Select value={selectedClientFilter} onValueChange={onClientFilterChange}>
                <SelectTrigger className="h-9 w-full sm:w-48 rounded-lg text-sm">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clientFilterOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {onCleanerFilterChange && (
              <Select value={selectedCleanerFilter} onValueChange={onCleanerFilterChange}>
                <SelectTrigger className="h-9 w-full sm:w-48 rounded-lg text-sm">
                  <SelectValue placeholder="Empleado" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Todos los empleados</SelectItem>
                  {cleanerFilterOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 pr-8 h-9 rounded-lg text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Limpiar búsqueda"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {searchResultsLabel && (
              <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline">
                {searchResultsLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
