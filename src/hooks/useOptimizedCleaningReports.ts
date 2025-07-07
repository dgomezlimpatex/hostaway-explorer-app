import { useMemo } from 'react';
import { useTaskReports } from './useTaskReports';
import { useCleaners } from './useCleaners';

interface Filters {
  dateRange: string;
  cleaner: string;
  status: string;
  property: string;
  hasIncidents: string;
}

export const useOptimizedCleaningReports = (filters: Filters) => {
  const { reports, isLoading: reportsLoading } = useTaskReports();
  const { cleaners, isLoading: cleanersLoading } = useCleaners();

  console.log('🔍 useOptimizedCleaningReports - Raw reports:', reports?.length || 0);
  console.log('🔍 useOptimizedCleaningReports - Filters:', filters);

  // Filtros aplicados solo cuando cambian los datos o filtros
  const filteredReports = useMemo(() => {
    console.log('🎯 Filtering reports - Input count:', reports?.length || 0);
    
    if (!reports) {
      console.log('❌ No reports available');
      return [];
    }

    const filtered = reports.filter(report => {
      // Filtro por limpiador
      if (filters.cleaner !== 'all' && report.cleaner_id !== filters.cleaner) {
        console.log(`🚫 Report ${report.id} filtered out by cleaner`);
        return false;
      }

      // Filtro por estado
      if (filters.status !== 'all' && report.overall_status !== filters.status) {
        console.log(`🚫 Report ${report.id} filtered out by status`);
        return false;
      }

      // Filtro por incidencias
      if (filters.hasIncidents === 'true' && (!report.issues_found || report.issues_found.length === 0)) {
        console.log(`🚫 Report ${report.id} filtered out - no incidents when required`);
        return false;
      }
      if (filters.hasIncidents === 'false' && report.issues_found && report.issues_found.length > 0) {
        console.log(`🚫 Report ${report.id} filtered out - has incidents when excluded`);
        return false;
      }

      // Filtro por fecha
      const reportDate = new Date(report.created_at);
      const today = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          const isToday = reportDate.toDateString() === today.toDateString();
          if (!isToday) console.log(`🚫 Report ${report.id} filtered out - not today`);
          return isToday;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const isYesterday = reportDate.toDateString() === yesterday.toDateString();
          if (!isYesterday) console.log(`🚫 Report ${report.id} filtered out - not yesterday`);
          return isYesterday;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const isThisWeek = reportDate >= weekAgo;
          if (!isThisWeek) console.log(`🚫 Report ${report.id} filtered out - not this week`);
          return isThisWeek;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          const isThisMonth = reportDate >= monthAgo;
          if (!isThisMonth) console.log(`🚫 Report ${report.id} filtered out - not this month`);
          return isThisMonth;
        case 'all':
        default:
          console.log(`✅ Report ${report.id} passes all filters`);
          return true;
      }
    });

    console.log('✅ Filtered reports count:', filtered.length);
    return filtered;
  }, [reports, filters]);

  // Memoizar estadísticas complejas
  const dashboardMetrics = useMemo(() => {
    const totalReports = filteredReports.length;
    const completedReports = filteredReports.filter(r => r.overall_status === 'completed').length;
    const pendingReports = filteredReports.filter(r => r.overall_status === 'pending').length;
    const inProgressReports = filteredReports.filter(r => r.overall_status === 'in_progress').length;
    const reportsWithIncidents = filteredReports.filter(r => r.issues_found && r.issues_found.length > 0).length;

    const completionRate = totalReports > 0 ? (completedReports / totalReports) * 100 : 0;

    return {
      totalReports,
      completedReports,
      pendingReports,
      inProgressReports,
      reportsWithIncidents,
      completionRate,
    };
  }, [filteredReports]);

  // Reportes recientes optimizados
  const recentReports = useMemo(() => {
    return [...filteredReports]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [filteredReports]);

  return {
    reports: filteredReports,
    dashboardMetrics,
    recentReports,
    cleaners: cleaners || [],
    isLoading: reportsLoading || cleanersLoading,
  };
};