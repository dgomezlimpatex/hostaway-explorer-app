import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Clock,
  Target,
  Award,
  Calendar,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useCleaners } from '@/hooks/useCleaners';
import AnalyticsExportService from '@/services/analyticsExport';
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
  
  const [exportFormat, setExportFormat] = React.useState<'excel' | 'pdf'>('excel');
  
  // Colores para gráficos
  const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

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

  // Datos para gráfico de barras de tendencias
  const chartData = useMemo(() => {
    return dailyTrends.map(day => ({
      ...day,
      completionRate: day.total > 0 ? Math.round((day.completed / day.total) * 100) : 0,
    }));
  }, [dailyTrends]);

  // Distribución de estados
  const statusDistribution = useMemo(() => {
    if (!reports) return [];

    const statusCounts = reports.reduce((acc: Record<string, number>, report) => {
      acc[report.overall_status] = (acc[report.overall_status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status === 'completed' ? 'Completado' : 
            status === 'pending' ? 'Pendiente' : 
            status === 'in_progress' ? 'En Progreso' : 'Necesita Revisión',
      value: count,
      percentage: reports.length > 0 ? Math.round((count / reports.length) * 100) : 0,
    }));
  }, [reports]);

  // Datos de incidencias para exportación
  const incidentsData = useMemo(() => {
    if (!reports) return [];

    const incidents: any[] = [];
    reports.forEach(report => {
      if (report.issues_found && Array.isArray(report.issues_found)) {
        report.issues_found.forEach((issue: any) => {
          const cleaner = cleaners.find(c => c.id === report.cleaner_id);
          incidents.push({
            id: `${report.id}-${issue.title}`,
            title: issue.title || 'Sin título',
            description: issue.description || '',
            severity: issue.severity || 'medium',
            status: issue.status || 'open',
            category: issue.category || 'general',
            location: issue.location || '',
            createdAt: report.created_at,
            resolvedAt: issue.resolvedAt,
            assignedTo: issue.assignedTo,
            resolutionNotes: issue.resolutionNotes || '',
            property: 'Propiedad', // TODO: Obtener de la tarea
            cleanerName: cleaner?.name || 'Desconocido',
          });
        });
      }
    });

    return incidents;
  }, [reports, cleaners]);

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
    const analyticsData = {
      generalMetrics: generalMetrics!,
      cleanerPerformance,
      dailyTrends,
      incidents: incidentsData,
    };

    if (exportFormat === 'excel') {
      AnalyticsExportService.exportToExcel(analyticsData);
    } else {
      AnalyticsExportService.exportToPDF(analyticsData);
    }
  };

  const handleExportIncidents = () => {
    AnalyticsExportService.exportIncidentsToExcel(incidentsData);
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
            <div className="flex items-center gap-3">
              <Select value={exportFormat} onValueChange={(value: 'excel' | 'pdf') => setExportFormat(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
              
              <Button onClick={handleExportAnalytics} variant="outline">
                {exportFormat === 'excel' ? <FileSpreadsheet className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Exportar {exportFormat.toUpperCase()}
              </Button>
              
              {incidentsData.length > 0 && (
                <Button onClick={handleExportIncidents} variant="outline">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Incidencias
                </Button>
              )}
            </div>
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

      {/* Gráficos de tendencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de líneas - Tendencias */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendencias de Completado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'completionRate' ? `${value}%` : value,
                    name === 'completionRate' ? 'Tasa de Finalización' : 
                    name === 'total' ? 'Total Reportes' : 'Completados'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="completionRate" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="completionRate"
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  name="total"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico circular - Estados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Distribución por Estados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras - Rendimiento semanal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Rendimiento Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  value,
                  name === 'total' ? 'Total Reportes' : 
                  name === 'completed' ? 'Completados' : 'Con Incidencias'
                ]}
              />
              <Bar dataKey="total" fill="#8884d8" name="total" />
              <Bar dataKey="completed" fill="#82ca9d" name="completed" />
              <Bar dataKey="withIncidents" fill="#ff7c7c" name="withIncidents" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tendencias diarias simplificadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Resumen Últimos 7 Días
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dailyTrends.map((day, index) => {
              const prevDay = index > 0 ? dailyTrends[index - 1] : null;
              const trend = prevDay ? day.total - prevDay.total : 0;
              
              return (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-16 text-sm font-medium">{day.date}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{day.total} reportes</span>
                      {trend !== 0 && (
                        <div className="flex items-center gap-1">
                          {trend > 0 ? (
                            <ChevronUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-red-600" />
                          )}
                          <span className={`text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Math.abs(trend)}
                          </span>
                        </div>
                      )}
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
              );
            })}
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