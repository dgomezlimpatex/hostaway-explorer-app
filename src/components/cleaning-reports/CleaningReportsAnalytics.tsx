import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Clock,
  Target,
  Award,
  Calendar,
  Download
} from 'lucide-react';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useCleaners } from '@/hooks/useCleaners';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface CleaningReportsAnalyticsProps {
  filters: {
    dateRange: string;
    cleaner: string;
    status: string;
    property: string;
    hasIncidents: string;
  };
}

export const CleaningReportsAnalytics: React.FC<CleaningReportsAnalyticsProps> = ({
  filters,
}) => {
  const { reports, isLoading } = useTaskReports();
  const { cleaners } = useCleaners();

  // Análisis de rendimiento por limpiador
  const cleanerPerformance = useMemo(() => {
    if (!reports || !cleaners) return [];

    const performance = cleaners.map(cleaner => {
      const cleanerReports = reports.filter(r => r.cleaner_id === cleaner.id);
      const totalReports = cleanerReports.length;
      const completedReports = cleanerReports.filter(r => r.overall_status === 'completed').length;
      const reportsWithIncidents = cleanerReports.filter(r => 
        r.issues_found && r.issues_found.length > 0
      ).length;
      
      const completionRate = totalReports > 0 ? (completedReports / totalReports) * 100 : 0;
      const qualityScore = totalReports > 0 ? 
        ((totalReports - reportsWithIncidents) / totalReports) * 100 : 100;

      // Calcular tiempo promedio
      const reportsWithTimes = cleanerReports.filter(r => r.start_time && r.end_time);
      const avgTime = reportsWithTimes.length > 0 ? 
        reportsWithTimes.reduce((acc, r) => {
          const start = new Date(r.start_time!);
          const end = new Date(r.end_time!);
          return acc + (end.getTime() - start.getTime());
        }, 0) / reportsWithTimes.length : 0;

      return {
        id: cleaner.id,
        name: cleaner.name,
        totalReports,
        completedReports,
        completionRate,
        reportsWithIncidents,
        qualityScore,
        avgTimeMinutes: Math.round(avgTime / (1000 * 60)),
      };
    });

    return performance.sort((a, b) => b.qualityScore - a.qualityScore);
  }, [reports, cleaners]);

  // Tendencias por día
  const dailyTrends = useMemo(() => {
    if (!reports) return [];

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      
      const dayReports = reports.filter(r => {
        const reportDate = new Date(r.created_at);
        return reportDate >= dayStart && reportDate <= dayEnd;
      });

      return {
        date: format(date, 'dd/MM', { locale: es }),
        fullDate: date,
        total: dayReports.length,
        completed: dayReports.filter(r => r.overall_status === 'completed').length,
        withIncidents: dayReports.filter(r => r.issues_found && r.issues_found.length > 0).length,
      };
    });

    return last7Days;
  }, [reports]);

  // Métricas generales
  const generalMetrics = useMemo(() => {
    if (!reports) return null;

    const totalReports = reports.length;
    const completedReports = reports.filter(r => r.overall_status === 'completed').length;
    const avgCompletionRate = totalReports > 0 ? (completedReports / totalReports) * 100 : 0;
    
    const reportsWithIncidents = reports.filter(r => 
      r.issues_found && r.issues_found.length > 0
    ).length;
    const qualityScore = totalReports > 0 ? 
      ((totalReports - reportsWithIncidents) / totalReports) * 100 : 100;

    // Tiempo promedio de limpieza
    const reportsWithTimes = reports.filter(r => r.start_time && r.end_time);
    const avgCleaningTime = reportsWithTimes.length > 0 ? 
      reportsWithTimes.reduce((acc, r) => {
        const start = new Date(r.start_time!);
        const end = new Date(r.end_time!);
        return acc + (end.getTime() - start.getTime());
      }, 0) / reportsWithTimes.length : 0;

    return {
      totalReports,
      completedReports,
      avgCompletionRate,
      qualityScore,
      avgCleaningTimeMinutes: Math.round(avgCleaningTime / (1000 * 60)),
      reportsWithIncidents,
    };
  }, [reports]);

  const handleExportAnalytics = () => {
    // TODO: Implementar exportación de analytics
    console.log('Exporting analytics data');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!generalMetrics) return null;

  return (
    <div className="space-y-6">
      {/* Header con exportación */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics y Tendencias
            </CardTitle>
            <Button onClick={handleExportAnalytics} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar Análisis
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas generales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Finalización</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {generalMetrics.avgCompletionRate.toFixed(1)}%
            </div>
            <Progress value={generalMetrics.avgCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calidad Promedio</CardTitle>
            <Award className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {generalMetrics.qualityScore.toFixed(1)}%
            </div>
            <Progress value={generalMetrics.qualityScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {generalMetrics.avgCleaningTimeMinutes}min
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Por limpieza
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reportes</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {generalMetrics.totalReports}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Período actual
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tendencias diarias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Tendencias Últimos 7 Días
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dailyTrends.map((day, index) => (
              <div key={day.date} className="flex items-center gap-4">
                <div className="w-16 text-sm font-medium">{day.date}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{day.total} reportes</span>
                    {day.completed > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {day.completed} completados
                      </Badge>
                    )}
                    {day.withIncidents > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {day.withIncidents} con incidencias
                      </Badge>
                    )}
                  </div>
                  <Progress 
                    value={day.total > 0 ? (day.completed / day.total) * 100 : 0} 
                    className="h-2"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rendimiento por limpiador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Rendimiento por Limpiador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cleanerPerformance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay datos de rendimiento disponibles
              </p>
            ) : (
              cleanerPerformance.map((cleaner, index) => (
                <div key={cleaner.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-medium">
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium">{cleaner.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {cleaner.totalReports} reportes totales
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        Calidad: {cleaner.qualityScore.toFixed(1)}%
                      </Badge>
                      <Badge variant="outline">
                        {cleaner.avgTimeMinutes}min promedio
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Tasa de finalización</span>
                        <span>{cleaner.completionRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={cleaner.completionRate} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Puntuación de calidad</span>
                        <span>{cleaner.qualityScore.toFixed(1)}%</span>
                      </div>
                      <Progress value={cleaner.qualityScore} className="h-2" />
                    </div>
                  </div>
                  
                  {cleaner.reportsWithIncidents > 0 && (
                    <div className="mt-3 p-2 bg-orange-50 rounded text-sm text-orange-800">
                      ⚠️ {cleaner.reportsWithIncidents} reporte(s) con incidencias
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};