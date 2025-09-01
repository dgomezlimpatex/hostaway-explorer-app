import { useMemo } from 'react';
import { useTaskReports } from './useTaskReports';
import { useCleaners } from './useCleaners';
import { useSede } from '@/contexts/SedeContext';

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
  const { activeSede } = useSede();

  // Filtros aplicados solo cuando cambian los datos o filtros
  const filteredReports = useMemo(() => {
    if (!reports) {
      return [];
    }

    const filtered = reports.filter(report => {
      // Filtro por limpiador
      if (filters.cleaner !== 'all' && report.cleaner_id !== filters.cleaner) {
        return false;
      }

      // Filtro por estado
      if (filters.status !== 'all' && report.overall_status !== filters.status) {
        return false;
      }

      // Filtro por incidencias
      if (filters.hasIncidents === 'true' && (!report.issues_found || report.issues_found.length === 0)) {
        return false;
      }
      if (filters.hasIncidents === 'false' && report.issues_found && report.issues_found.length > 0) {
        return false;
      }

      // Filtro por fecha
      const reportDate = new Date(report.created_at);
      const today = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          return reportDate.toDateString() === today.toDateString();
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return reportDate.toDateString() === yesterday.toDateString();
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return reportDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return reportDate >= monthAgo;
        case 'all':
        default:
          return true;
      }
    });

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