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
  Users,
  TrendingUp,
  TrendingDown,
  CheckCircle
} from 'lucide-react';
import { useWorkloadCalculation } from '@/hooks/useWorkloadCalculation';
import { WorkloadTable } from '@/components/workload/WorkloadTable';
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

  const workersWithContracts = (workloadData || []).filter(w => w.contractHoursPerWeek > 0);
  const workersWithoutContracts = (workloadData || []).filter(w => w.contractHoursPerWeek === 0);
  
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
            <div className="p-4 sm:p-6">
              <div className="max-w-6xl mx-auto space-y-4">
                {/* Header + Controls in one row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Clock className="h-6 w-6" />
                    Control de Horas
                  </h1>
                  <div className="flex items-center gap-2">
                    <Tabs value={viewType} onValueChange={(v) => setViewType(v as 'weekly' | 'monthly')}>
                      <TabsList className="h-8">
                        <TabsTrigger value="weekly" className="text-xs px-3">Semanal</TabsTrigger>
                        <TabsTrigger value="monthly" className="text-xs px-3">Mensual</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button size="sm" onClick={() => handleAddAdjustment()}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Ajuste
                    </Button>
                  </div>
                </div>

                {/* Date nav + Summary bar */}
                <Card>
                  <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      {/* Date navigation */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevious}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium min-w-[180px] text-center">
                          {getDateRangeLabel()}
                        </span>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNext}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Inline summary stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{workersWithContracts.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">{onTrackWorkers.length}</span>
                        </div>
                        {overtimeWorkers.length > 0 && (
                          <div className="flex items-center gap-1.5 text-amber-600">
                            <TrendingUp className="h-4 w-4" />
                            <span className="font-medium">{overtimeWorkers.length}</span>
                          </div>
                        )}
                        {deficitWorkers.length > 0 && (
                          <div className="flex items-center gap-1.5 text-red-600">
                            <TrendingDown className="h-4 w-4" />
                            <span className="font-medium">{deficitWorkers.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Worker table */}
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
                        Configura contratos en la sección de Trabajadores
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <WorkloadTable
                    workers={workersWithContracts}
                    onAddAdjustment={handleAddAdjustment}
                  />
                )}

                {/* Workers without contracts */}
                {workersWithoutContracts.length > 0 && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-xs text-muted-foreground">
                        Sin contrato ({workersWithoutContracts.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {workersWithoutContracts.map(w => (
                          <Badge key={w.cleanerId} variant="outline" className="text-xs">
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

      <HourAdjustmentModal
        open={isAdjustmentModalOpen}
        onOpenChange={setIsAdjustmentModalOpen}
        preselectedCleanerId={selectedCleanerIdForAdjustment}
      />
    </SidebarProvider>
  );
};

export default WorkloadDashboard;
