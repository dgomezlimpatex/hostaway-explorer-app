import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, ArrowLeft, Users, Search, X, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { civilDateToLocalDate, getVisibleDays } from "./utils/multiDayCalendar";
import { cn } from "@/lib/utils";
import { ViewType } from "@/types/calendar";
import { Link } from "react-router-dom";
import { useDeviceType } from "@/hooks/use-mobile";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { useState } from "react";
import { ZOOM_LABELS, type TimelineZoom } from "./utils/timelineScale";

interface ResponsiveCalendarHeaderProps {
  currentDate: Date;
  currentView: ViewType;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onViewChange: (view: ViewType) => void;
  /** Hidden when the role cannot create tasks. */
  onNewTask?: () => void;
  onNewBatchTask?: () => void;
  /** Jump to any date (civil date picker). */
  onSelectDate?: (date: Date) => void;
  zoom?: TimelineZoom;
  onZoomChange?: (zoom: TimelineZoom) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  showSearch?: boolean;
  searchResultsLabel?: string;
  clientFilterOptions?: Array<{ id: string; name: string }>;
  cleanerFilterOptions?: Array<{ id: string; name: string }>;
  selectedClientFilters?: string[];
  selectedCleanerFilters?: string[];
  onClientFiltersChange?: (value: string[]) => void;
  onCleanerFiltersChange?: (value: string[]) => void;
}

export const ResponsiveCalendarHeader = ({
  currentDate,
  currentView,
  onNavigateDate,
  onGoToToday,
  onViewChange,
  onNewTask,
  onNewBatchTask,
  onSelectDate,
  zoom = 'normal',
  onZoomChange,
  searchTerm = '',
  onSearchChange,
  showSearch = false,
  searchResultsLabel,
  clientFilterOptions = [],
  cleanerFilterOptions = [],
  selectedClientFilters = [],
  selectedCleanerFilters = [],
  onClientFiltersChange,
  onCleanerFiltersChange,
}: ResponsiveCalendarHeaderProps) => {
  const { isMobile } = useDeviceType();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const formatDate = () => {
    switch (currentView) {
      case 'day':
        return format(currentDate, isMobile ? "EEE d MMM" : "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
      case 'three-day':
      case 'week': {
        // Same civil range the grid shows (the week always runs Monday to Sunday).
        const days = getVisibleDays(currentDate, currentView);
        const startDate = civilDateToLocalDate(days[0]);
        const endDate = civilDateToLocalDate(days[days.length - 1]);
        const prefix = currentView === 'week' ? (isMobile ? 'Sem. ' : 'Semana: ') : '';
        if (isMobile) {
          return `${prefix}${format(startDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM", { locale: es })}`;
        }
        return `${prefix}${format(startDate, "d 'de' MMM", { locale: es })} - ${format(endDate, "d 'de' MMM 'de' yyyy", { locale: es })}`;
      }
      default:
        return format(currentDate, isMobile ? "d MMM yyyy" : "d 'de' MMMM 'de' yyyy", { locale: es });
    }
  };

  // date-fns devuelve los meses en minúscula ("septiembre"); la clase CSS `capitalize`
  // pondría en mayúscula cada palabra ("24 De Septiembre De 2026"), así que solo
  // capitalizamos la primera letra.
  const capitalizeFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <div className="rounded-lg overflow-hidden shadow-lg border border-border/40">
      {/* ===== BARRA DE TÍTULO Y ACCIONES ===== */}
      <div className="relative bg-gradient-to-r from-[hsl(258,70%,28%)] via-[hsl(262,65%,32%)] to-[hsl(268,60%,38%)] text-white">
        {/* Brillo suave para dar profundidad */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_150%_at_0%_0%,rgba(255,255,255,0.18),transparent_60%)]" />
        <div className="relative flex items-center justify-between gap-2 md:gap-4 px-2 md:px-4 py-2.5 md:py-3">
          {/* Izquierda: volver + título */}
          <div className="flex items-center gap-1.5 md:gap-2.5 min-w-0 flex-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="shrink-0 text-white/85 hover:bg-white/15 hover:text-white h-9 w-9 rounded-lg"
            >
              <Link to="/" aria-label="Volver al menú">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <h1 className="text-base md:text-lg font-semibold tracking-tight truncate leading-tight">
              {isMobile ? "Calendario" : "Calendario de Limpieza"}
            </h1>
          </div>

          {/* Derecha: acciones */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {onNewBatchTask && (
              <Button
                onClick={onNewBatchTask}
                size={isMobile ? "sm" : "default"}
                variant="ghost"
                className="gap-1.5 h-9 text-white border border-white/25 bg-white/10 hover:bg-white/20 hover:text-white rounded-lg"
              >
                <Users className="h-4 w-4" />
                {!isMobile && <span>Múltiples</span>}
              </Button>
            )}
            {onNewTask && (
              <Button
                onClick={onNewTask}
                size={isMobile ? "sm" : "default"}
                className="gap-1.5 h-9 bg-white text-[hsl(262,60%,30%)] hover:bg-white/90 hover:text-[hsl(262,60%,30%)] font-semibold rounded-lg shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {!isMobile && <span>Nueva Tarea</span>}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ===== BARRA DE CONTROL: navegación + fecha + selector de vista ===== */}
      <div className="bg-card border-t border-border/40 px-2 md:px-4 py-2 md:py-2.5">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Navegación y fecha: único sitio donde se muestra la fecha */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigateDate('prev')}
                className="h-8 w-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <button
                type="button"
                onClick={onGoToToday}
                className="px-3 h-8 text-xs md:text-sm font-semibold rounded-md text-foreground transition-colors hover:bg-background"
              >
                Hoy
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigateDate('next')}
                className="h-8 w-8 rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="Siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {onSelectDate ? (
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="min-w-0 flex items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-sm md:text-[15px] font-semibold text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Elegir fecha. Fecha mostrada: ${formatDate()}`}
                  >
                    <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{capitalizeFirst(formatDate())}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DatePicker
                    mode="single"
                    selected={currentDate}
                    defaultMonth={currentDate}
                    weekStartsOn={1}
                    onSelect={(date) => {
                      if (!date) return;
                      // Local noon: the civil date never moves with the timezone.
                      onSelectDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12));
                      setIsDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <span className="min-w-0 truncate text-sm md:text-[15px] font-semibold text-foreground">
                {capitalizeFirst(formatDate())}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
          {/* Densidad de la línea temporal (solo vista Día) */}
          {currentView === 'day' && onZoomChange && !isMobile && (
            <div className="flex items-center bg-muted rounded-lg p-1" role="group" aria-label="Densidad de la línea temporal">
              {(['compact', 'normal', 'wide'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onZoomChange(level)}
                  aria-pressed={zoom === level}
                  className={cn(
                    "px-2 py-1.5 text-xs font-medium rounded-md transition-all",
                    zoom === level ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {ZOOM_LABELS[level]}
                </button>
              ))}
            </div>
          )}

          {/* Selector de vista (segmented control) */}
          <div className="flex items-center bg-muted rounded-lg p-1 shrink-0" role="group" aria-label="Vista del calendario">
            {(['day', 'three-day', 'week'] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={currentView === view}
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
        </div>

        {/* Filtros (solo admin): desplegables cliente/empleado + buscador pequeño */}
        {showSearch && onSearchChange && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {onClientFiltersChange && (
              <MultiSelectFilter
                options={clientFilterOptions}
                selected={selectedClientFilters}
                onChange={onClientFiltersChange}
                placeholder="clientes"
                allLabel="Todos los clientes"
                className="w-full sm:w-48"
              />
            )}

            {onCleanerFiltersChange && (
              <MultiSelectFilter
                options={cleanerFilterOptions}
                selected={selectedCleanerFilters}
                onChange={onCleanerFiltersChange}
                placeholder="empleados"
                allLabel="Todos los empleados"
                className="w-full sm:w-48"
              />
            )}

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar..."
                aria-label="Buscar tareas por propiedad, dirección, cliente o trabajadora"
                type="search"
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
              <span className="text-xs text-muted-foreground whitespace-nowrap hidden md:inline" role="status">
                {searchResultsLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
