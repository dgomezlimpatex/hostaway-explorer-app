import React, { useState } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { MobileDashboardHeader } from '@/components/dashboard/MobileDashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Plus, 
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useWorkloadCalculation } from '@/hooks/useWorkloadCalculation';
import { WorkloadOverviewCard } from '@/components/workload/WorkloadOverviewCard';
import { HourAdjustmentModal } from '@/components/workload/HourAdjustmentModal';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths 
} from 'date-fns';
import { es } from 'date-fns/locale';

const WorkloadDashboard = () => {
  const isMobile = useIsMobile();
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedCleanerIdForAdjustment, setSelectedCleanerIdForAdjustment] = useState<string | undefined>();

  // Calculate date range based on view type
  const getDateRange = () => {
    if (viewType === 'weekly') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }
  };

  const dateRange = getDateRange();
  const startDate = format(dateRange.start, 'yyyy-MM-dd');
  const endDate = format(dateRange.end, 'yyyy-MM-dd');

  const { data: workloadData, isLoading } = useWorkloadCalculation({
    startDate,
    endDate,
  });

  const handlePrevious = () => {
    if (viewType === 'weekly') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewType === 'weekly') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleAddAdjustment = (cleanerId?: string) => {
    setSelectedCleanerIdForAdjustment(cleanerId);
    setIsAdjustmentModalOpen(true);
  };

  const getDateRangeLabel = () => {
    if (viewType === 'weekly') {
      return `${format(dateRange.start, "d MMM", { locale: es })} - ${format(dateRange.end, "d MMM yyyy", { locale: es })}`;
    } else {
      return format(dateRange.start, "MMMM yyyy", { locale: es });
    }
  };

  // Filter workers with contracts
  const workersWithContracts = (workloadData || []).filter(w => w.contractHoursPerWeek > 0);
  const workersWithoutContracts = (workloadData || []).filter(w => w.contractHoursPerWeek === 0);
  
  // Summary stats
  const overtimeWorkers = workersWithContracts.filter(w => w.status === 'overtime');
  const deficitWorkers = workersWithContracts.filter(w => w.status === 'deficit' || w.status === 'critical-deficit');
  const onTrackWorkers = workersWithContracts.filter(w => w.status === 'on-track');

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-gray-50">
        <MobileDashboardHeader />
        
        <div className="flex min-h-screen w-full">
          {!isMobile && <DashboardSidebar />}
          
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                      <Clock className="h-8 w-8" />
                      Control de Horas
                    </h1>
                    <p className="text-muted-foreground mt-1">
                      Seguimiento de horas trabajadas vs contrato
                    </p>
                  </div>
                  <Button onClick={() => handleAddAdjustment()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Ajuste
                  </Button>
                </div>

                {/* Controls */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Date navigation */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handlePrevious}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-lg font-medium min-w-[200px] text-center">
                          {getDateRangeLabel()}
                        </span>
                        <Button variant="outline" size="icon" onClick={handleNext}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* View type toggle */}
                      <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'weekly' | 'monthly')}>
                        <TabsList>
                          <TabsTrigger value="weekly">Semanal</TabsTrigger>
                          <TabsTrigger value="monthly">Mensual</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Trabajadores</p>
                          <p className="text-2xl font-bold">{workersWithContracts.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Clock className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">En Rango</p>
                          <p className="text-2xl font-bold text-green-600">{onTrackWorkers.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Horas Extra</p>
                          <p className="text-2xl font-bold text-amber-600">{overtimeWorkers.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Déficit</p>
                          <p className="text-2xl font-bold text-red-600">{deficitWorkers.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Alerts */}
                {(overtimeWorkers.length > 0 || deficitWorkers.length > 0) && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <h3 className="font-medium text-amber-900">Alertas de Horas</h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {overtimeWorkers.map(w => (
                              <Badge key={w.cleanerId} variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                                {w.cleanerName}: +{w.overtimeHours.toFixed(1)}h extra
                              </Badge>
                            ))}
                            {deficitWorkers.map(w => (
                              <Badge key={w.cleanerId} variant="outline" className="bg-red-100 text-red-800 border-red-300">
                                {w.cleanerName}: -{w.remainingHours.toFixed(1)}h déficit
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Worker list */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : workersWithContracts.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Sin trabajadores con contrato</h3>
                      <p className="text-muted-foreground">
                        Configura contratos para los trabajadores en la sección de Trabajadores
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold">
                      Trabajadores ({workersWithContracts.length})
                    </h2>
                    <div className="grid gap-4">
                      {workersWithContracts.map(summary => (
                        <WorkloadOverviewCard
                          key={summary.cleanerId}
                          summary={summary}
                          onAddAdjustment={handleAddAdjustment}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Workers without contracts */}
                {workersWithoutContracts.length > 0 && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">
                        Trabajadores sin contrato configurado ({workersWithoutContracts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {workersWithoutContracts.map(w => (
                          <Badge key={w.cleanerId} variant="outline">
                            {w.cleanerName}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Adjustment Modal */}
      <HourAdjustmentModal
        open={isAdjustmentModalOpen}
        onOpenChange={setIsAdjustmentModalOpen}
        preselectedCleanerId={selectedCleanerIdForAdjustment}
      />
    </SidebarProvider>
  );
};

export default WorkloadDashboard;
