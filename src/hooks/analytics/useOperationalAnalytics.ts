
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';

export interface PropertyEstimationAnalysis {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  estimatedMinutes: number;
  avgActualMinutes: number;
  taskCount: number;
  differenceMinutes: number;
  differencePercentage: number;
  suggestedDuration: number;
  status: 'overestimated' | 'underestimated' | 'accurate';
}

export interface CleanerPerformanceAnalysis {
  cleanerId: string;
  cleanerName: string;
  avgPunctuality: number; // minutos de diferencia promedio
  avgEfficiency: number; // porcentaje
  consistencyScore: number; // desviación estándar
  taskCount: number;
  avgTaskDuration: number;
  minDuration: number;
  maxDuration: number;
  onTimePercentage: number;
  earlyPercentage: number;
  latePercentage: number;
}

export interface DayOfWeekPattern {
  dayOfWeek: number;
  dayName: string;
  avgDuration: number;
  taskCount: number;
  avgEfficiency: number;
}

export interface HourlyPattern {
  hour: number;
  avgDuration: number;
  taskCount: number;
}

export interface CleanerPropertyCorrelation {
  cleanerId: string;
  cleanerName: string;
  propertyId: string;
  propertyName: string;
  taskCount: number;
  avgDuration: number;
  efficiency: number;
  isEfficient: boolean;
}

export interface OperationalAnalyticsData {
  propertyEstimations: PropertyEstimationAnalysis[];
  cleanerPerformance: CleanerPerformanceAnalysis[];
  dayOfWeekPatterns: DayOfWeekPattern[];
  hourlyPatterns: HourlyPattern[];
  cleanerPropertyCorrelations: CleanerPropertyCorrelation[];
  summary: {
    totalTasksAnalyzed: number;
    avgEfficiency: number;
    propertiesNeedingAdjustment: number;
    cleanersWithIssues: number;
  };
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const useOperationalAnalytics = (dateRange?: { start: Date; end: Date }) => {
  const { activeSede } = useSede();
  
  return useQuery({
    queryKey: ['operationalAnalytics', activeSede?.id, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<OperationalAnalyticsData> => {
      // Build date filter for tasks
      const startDate = dateRange?.start ? dateRange.start.toISOString().split('T')[0] : null;
      const endDate = dateRange?.end ? dateRange.end.toISOString().split('T')[0] : null;

      // Fetch task reports with tasks and properties in a single query
      let query = supabase
        .from('task_reports')
        .select(`
          id,
          task_id,
          cleaner_id,
          start_time,
          end_time,
          overall_status,
          created_at,
          tasks!inner (
            id,
            duracion,
            start_time,
            date,
            propiedad_id,
            cleaner_id,
            sede_id,
            status,
            properties:propiedad_id (
              id,
              nombre,
              codigo,
              duracion_servicio
            )
          )
        `)
        .not('start_time', 'is', null)
        .not('end_time', 'is', null);

      // Apply sede filter through tasks
      if (activeSede?.id) {
        query = query.eq('tasks.sede_id', activeSede.id);
      }

      // Apply date range filter through tasks
      if (startDate) {
        query = query.gte('tasks.date', startDate);
      }
      if (endDate) {
        query = query.lte('tasks.date', endDate);
      }

      const { data: taskReportsWithTasks, error: reportsError } = await query;
      if (reportsError) throw reportsError;

      // Fetch cleaners for name lookup
      let cleanersQuery = supabase.from('cleaners').select('id, name');
      if (activeSede?.id) {
        cleanersQuery = cleanersQuery.eq('sede_id', activeSede.id);
      }
      const { data: cleaners, error: cleanersError } = await cleanersQuery;
      if (cleanersError) throw cleanersError;

      const cleanerMap = new Map(cleaners?.map(c => [c.id, c.name]) || []);

      // Process combined data
      const combinedData = (taskReportsWithTasks || [])
        .map(report => {
          const task = report.tasks as any;
          if (!task || !task.properties) return null;
          
          const startTime = new Date(report.start_time!);
          const endTime = new Date(report.end_time!);
          const actualMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
          
          // Filter out unrealistic durations
          if (actualMinutes < 1 || actualMinutes > 480) return null;
          
          const scheduledStart = task.start_time ? 
            new Date(`${task.date}T${task.start_time}`) : null;
          
          let punctualityMinutes = 0;
          if (scheduledStart) {
            punctualityMinutes = (startTime.getTime() - scheduledStart.getTime()) / (1000 * 60);
          }
          
          const properties = task.properties as any;
          
          return {
            reportId: report.id,
            taskId: report.task_id,
            cleanerId: report.cleaner_id || task.cleaner_id,
            cleanerName: cleanerMap.get(report.cleaner_id || task.cleaner_id || '') || 'Desconocido',
            propertyId: task.propiedad_id,
            propertyName: properties?.nombre || 'Desconocida',
            propertyCode: properties?.codigo || '',
            estimatedMinutes: task.duracion || properties?.duracion_servicio || 60,
            actualMinutes,
            punctualityMinutes,
            dayOfWeek: new Date(task.date).getDay(),
            hour: scheduledStart?.getHours() || startTime.getHours(),
            taskDate: new Date(task.date),
          };
        })
        .filter(Boolean) as Array<{
          reportId: string;
          taskId: string;
          cleanerId: string;
          cleanerName: string;
          propertyId: string;
          propertyName: string;
          propertyCode: string;
          estimatedMinutes: number;
          actualMinutes: number;
          punctualityMinutes: number;
          dayOfWeek: number;
          hour: number;
          taskDate: Date;
        }>;

      // Data is already filtered by date range in query
      const filteredData = combinedData;

      // 1. Property Estimations Analysis
      const propertyGroups = new Map<string, typeof filteredData>();
      filteredData.forEach(d => {
        const group = propertyGroups.get(d.propertyId) || [];
        group.push(d);
        propertyGroups.set(d.propertyId, group);
      });

      const propertyEstimations: PropertyEstimationAnalysis[] = Array.from(propertyGroups.entries())
        .map(([propertyId, items]) => {
          const avgActual = items.reduce((sum, i) => sum + i.actualMinutes, 0) / items.length;
          const estimated = items[0].estimatedMinutes;
          const diff = avgActual - estimated;
          const diffPercent = ((diff / estimated) * 100);
          
          let status: 'overestimated' | 'underestimated' | 'accurate' = 'accurate';
          if (diffPercent < -15) status = 'overestimated';
          else if (diffPercent > 15) status = 'underestimated';
          
          return {
            propertyId,
            propertyName: items[0].propertyName,
            propertyCode: items[0].propertyCode,
            estimatedMinutes: estimated,
            avgActualMinutes: Math.round(avgActual),
            taskCount: items.length,
            differenceMinutes: Math.round(diff),
            differencePercentage: Math.round(diffPercent),
            suggestedDuration: Math.round(avgActual / 5) * 5, // Round to nearest 5
            status,
          };
        })
        .filter(p => p.taskCount >= 2)
        .sort((a, b) => Math.abs(b.differencePercentage) - Math.abs(a.differencePercentage));

      // 2. Cleaner Performance Analysis
      const cleanerGroups = new Map<string, typeof filteredData>();
      filteredData.forEach(d => {
        if (!d.cleanerId) return;
        const group = cleanerGroups.get(d.cleanerId) || [];
        group.push(d);
        cleanerGroups.set(d.cleanerId, group);
      });

      const cleanerPerformance: CleanerPerformanceAnalysis[] = Array.from(cleanerGroups.entries())
        .map(([cleanerId, items]) => {
          const avgPunctuality = items.reduce((sum, i) => sum + i.punctualityMinutes, 0) / items.length;
          const avgDuration = items.reduce((sum, i) => sum + i.actualMinutes, 0) / items.length;
          
          const efficiencies = items.map(i => (i.estimatedMinutes / i.actualMinutes) * 100);
          const avgEfficiency = efficiencies.reduce((sum, e) => sum + e, 0) / efficiencies.length;
          
          // Standard deviation for consistency
          const mean = avgDuration;
          const squaredDiffs = items.map(i => Math.pow(i.actualMinutes - mean, 2));
          const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / squaredDiffs.length;
          const stdDev = Math.sqrt(avgSquaredDiff);
          
          // Punctuality breakdown
          const onTime = items.filter(i => Math.abs(i.punctualityMinutes) <= 10).length;
          const early = items.filter(i => i.punctualityMinutes < -10).length;
          const late = items.filter(i => i.punctualityMinutes > 10).length;
          
          return {
            cleanerId,
            cleanerName: items[0].cleanerName,
            avgPunctuality: Math.round(avgPunctuality),
            avgEfficiency: Math.round(avgEfficiency),
            consistencyScore: Math.round(stdDev),
            taskCount: items.length,
            avgTaskDuration: Math.round(avgDuration),
            minDuration: Math.round(Math.min(...items.map(i => i.actualMinutes))),
            maxDuration: Math.round(Math.max(...items.map(i => i.actualMinutes))),
            onTimePercentage: Math.round((onTime / items.length) * 100),
            earlyPercentage: Math.round((early / items.length) * 100),
            latePercentage: Math.round((late / items.length) * 100),
          };
        })
        .filter(c => c.taskCount >= 3)
        .sort((a, b) => b.avgEfficiency - a.avgEfficiency);

      // 3. Day of Week Patterns
      const dayGroups = new Map<number, typeof filteredData>();
      filteredData.forEach(d => {
        const group = dayGroups.get(d.dayOfWeek) || [];
        group.push(d);
        dayGroups.set(d.dayOfWeek, group);
      });

      const dayOfWeekPatterns: DayOfWeekPattern[] = Array.from(dayGroups.entries())
        .map(([day, items]) => {
          const avgDuration = items.reduce((sum, i) => sum + i.actualMinutes, 0) / items.length;
          const avgEff = items.reduce((sum, i) => sum + (i.estimatedMinutes / i.actualMinutes) * 100, 0) / items.length;
          
          return {
            dayOfWeek: day,
            dayName: DAY_NAMES[day],
            avgDuration: Math.round(avgDuration),
            taskCount: items.length,
            avgEfficiency: Math.round(avgEff),
          };
        })
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

      // 4. Hourly Patterns
      const hourGroups = new Map<number, typeof filteredData>();
      filteredData.forEach(d => {
        const group = hourGroups.get(d.hour) || [];
        group.push(d);
        hourGroups.set(d.hour, group);
      });

      const hourlyPatterns: HourlyPattern[] = Array.from(hourGroups.entries())
        .map(([hour, items]) => ({
          hour,
          avgDuration: Math.round(items.reduce((sum, i) => sum + i.actualMinutes, 0) / items.length),
          taskCount: items.length,
        }))
        .sort((a, b) => a.hour - b.hour);

      // 5. Cleaner-Property Correlations
      const correlationGroups = new Map<string, typeof filteredData>();
      filteredData.forEach(d => {
        if (!d.cleanerId) return;
        const key = `${d.cleanerId}-${d.propertyId}`;
        const group = correlationGroups.get(key) || [];
        group.push(d);
        correlationGroups.set(key, group);
      });

      const cleanerPropertyCorrelations: CleanerPropertyCorrelation[] = Array.from(correlationGroups.entries())
        .map(([key, items]) => {
          const avgDuration = items.reduce((sum, i) => sum + i.actualMinutes, 0) / items.length;
          const avgEfficiency = items.reduce((sum, i) => sum + (i.estimatedMinutes / i.actualMinutes) * 100, 0) / items.length;
          
          return {
            cleanerId: items[0].cleanerId,
            cleanerName: items[0].cleanerName,
            propertyId: items[0].propertyId,
            propertyName: items[0].propertyName,
            taskCount: items.length,
            avgDuration: Math.round(avgDuration),
            efficiency: Math.round(avgEfficiency),
            isEfficient: avgEfficiency >= 90,
          };
        })
        .filter(c => c.taskCount >= 2)
        .sort((a, b) => b.efficiency - a.efficiency);

      // Summary
      const totalEfficiency = filteredData.length > 0 
        ? filteredData.reduce((sum, d) => sum + (d.estimatedMinutes / d.actualMinutes) * 100, 0) / filteredData.length
        : 0;

      return {
        propertyEstimations,
        cleanerPerformance,
        dayOfWeekPatterns,
        hourlyPatterns,
        cleanerPropertyCorrelations,
        summary: {
          totalTasksAnalyzed: filteredData.length,
          avgEfficiency: Math.round(totalEfficiency),
          propertiesNeedingAdjustment: propertyEstimations.filter(p => p.status !== 'accurate').length,
          cleanersWithIssues: cleanerPerformance.filter(c => c.avgEfficiency < 80 || c.latePercentage > 30).length,
        },
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
