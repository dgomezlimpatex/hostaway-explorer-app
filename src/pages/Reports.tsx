
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReportFiltersComponent } from '@/components/reports/ReportFilters';
import { TaskReportTable, BillingReportTable, SummaryReportCard, LaundryReportTable } from '@/components/reports/ReportTables';
import { useReports } from '@/hooks/useReports';
import { exportToCSV } from '@/services/csvExport';
import { ReportFilters } from '@/types/filters';
import { Link } from 'react-router-dom';

export default function Reports() {
  const [filters, setFilters] = useState<ReportFilters>({
    reportType: 'tasks',
    dateRange: 'today'
  });

  const { data: reportData, isLoading } = useReports(filters);

  const handleExportCSV = () => {
    if (!reportData) return;
    
    const filename = `reporte_${filters.reportType}_${new Date().toISOString().split('T')[0]}`;
    exportToCSV(reportData, filename, filters.reportType);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Sistema de Reportes</h1>
            <p className="text-gray-600">Genera y exporta reportes detallados de tu negocio</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportCSV} disabled={!reportData || isLoading}>
              📥 Exportar CSV
            </Button>
            <Link to="/">
              <Button variant="outline">
                🏠 Volver al Menú
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <ReportFiltersComponent filters={filters} onFiltersChange={setFilters} />

        {/* Contenido del Reporte */}
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <div className="text-lg">Generando reporte...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {filters.reportType === 'tasks' && reportData && Array.isArray(reportData) && (
              <TaskReportTable data={reportData as any[]} />
            )}
            
            {filters.reportType === 'billing' && reportData && Array.isArray(reportData) && (
              <BillingReportTable data={reportData as any[]} />
            )}
            
            {filters.reportType === 'summary' && reportData && !Array.isArray(reportData) && (
              <SummaryReportCard data={reportData as any} />
            )}

            {filters.reportType === 'laundry' && reportData && Array.isArray(reportData) && (
              <LaundryReportTable data={reportData as any[]} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
