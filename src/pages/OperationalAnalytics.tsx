
import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, BarChart3, Users, Building2, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOperationalAnalytics } from '@/hooks/analytics/useOperationalAnalytics';
import { PropertyEstimationsPanel } from '@/components/analytics/PropertyEstimationsPanel';
import { CleanerPerformancePanel } from '@/components/analytics/CleanerPerformancePanel';
import { TemporalPatternsPanel } from '@/components/analytics/TemporalPatternsPanel';
import { CorrelationsPanel } from '@/components/analytics/CorrelationsPanel';
import { AnalyticsSummaryCards } from '@/components/analytics/AnalyticsSummaryCards';

const OperationalAnalytics = () => {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subMonths(new Date(), 6),
    end: new Date(),
  });

  const { data, isLoading, error } = useOperationalAnalytics(dateRange);

  const quickRanges = [
    { label: 'Última semana', days: 7 },
    { label: 'Último mes', days: 30 },
    { label: 'Últimos 3 meses', days: 90 },
    { label: 'Último año', days: 365 },
  ];

  const setQuickRange = (days: number) => {
    setDateRange({
      start: subDays(new Date(), days),
      end: new Date(),
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto p-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">Error al cargar los datos de análisis: {error.message}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Análisis Operativo</h1>
            <p className="text-muted-foreground">
              Análisis de rendimiento, estimaciones y patrones operativos
            </p>
          </div>

          {/* Date Range Selector */}
          <div className="flex flex-wrap gap-2">
            {quickRanges.map((range) => (
              <Button
                key={range.days}
                variant="outline"
                size="sm"
                onClick={() => setQuickRange(range.days)}
              >
                {range.label}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(dateRange.start, 'dd/MM/yy', { locale: es })} - {format(dateRange.end, 'dd/MM/yy', { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.start, to: dateRange.end }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ start: range.from, end: range.to });
                    }
                  }}
                  locale={es}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Analizando datos...</span>
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <AnalyticsSummaryCards summary={data.summary} />

            {/* Main Content Tabs */}
            <Tabs defaultValue="properties" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                <TabsTrigger value="properties" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Propiedades</span>
                </TabsTrigger>
                <TabsTrigger value="cleaners" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Trabajadores</span>
                </TabsTrigger>
                <TabsTrigger value="patterns" className="gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Patrones</span>
                </TabsTrigger>
                <TabsTrigger value="correlations" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Correlaciones</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="properties">
                <PropertyEstimationsPanel estimations={data.propertyEstimations} />
              </TabsContent>

              <TabsContent value="cleaners">
                <CleanerPerformancePanel performance={data.cleanerPerformance} />
              </TabsContent>

              <TabsContent value="patterns">
                <TemporalPatternsPanel 
                  dayPatterns={data.dayOfWeekPatterns} 
                  hourPatterns={data.hourlyPatterns} 
                />
              </TabsContent>

              <TabsContent value="correlations">
                <CorrelationsPanel correlations={data.cleanerPropertyCorrelations} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No hay datos disponibles para el rango seleccionado
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default OperationalAnalytics;
