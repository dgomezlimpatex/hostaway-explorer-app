
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReportFiltersComponent } from '@/components/reports/ReportFilters';
import { TaskReportTable, BillingReportTable, SummaryReportCard, LaundryReportTable } from '@/components/reports/ReportTables';
import { EditableTaskTable } from '@/components/reports/EditableTaskTable';
import { useReports } from '@/hooks/useReports';
import { useEditableReportData } from '@/hooks/reports/useEditableReportData';
import { exportToCSV } from '@/services/csvExport';
import { exportToExcel } from '@/services/excelExport';
import { ReportFilters } from '@/types/filters';
import { Link } from 'react-router-dom';
import ReportExportTokenManager from '@/components/reports/ReportExportTokenManager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Reports() {
  const [filters, setFilters] = useState<ReportFilters>({
    reportType: 'tasks',
    dateRange: 'today'
  });

  const { data: reportData, isLoading } = useReports(filters);

  // Editable data hook for tasks
  const editableData = useEditableReportData(filters);

  const handleExportCSV = () => {
    if (!reportData) return;
    const filename = `reporte_${filters.reportType}_${new Date().toISOString().split('T')[0]}`;
    exportToCSV(reportData, filename, filters.reportType);
  };

  const handleExportExcel = () => {
    if (!reportData) return;
    const filename = `reporte_${filters.reportType}_${new Date().toISOString().split('T')[0]}`;
    exportToExcel(reportData, filename, filters.reportType, true);
  };

  const isTasksReport = filters.reportType === 'tasks';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">📊 Reportes</h1>
            <p className="text-sm sm:text-base text-gray-600">Genera y exporta reportes de tu negocio</p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!reportData || isLoading} className="flex-1 sm:flex-none">
                  📥 Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  📄 Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  📊 Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/">
              <Button variant="outline" size="icon" className="sm:hidden">
                🏠
              </Button>
              <Button variant="outline" className="hidden sm:inline-flex">
                🏠 Volver al Menú
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <ReportFiltersComponent filters={filters} onFiltersChange={setFilters} />

        {/* Contenido del Reporte */}
        {isTasksReport ? (
          <EditableTaskTable
            key="editable-tasks"
            tasks={editableData.tasks}
            isLoading={editableData.isLoading}
            updateField={editableData.updateField}
            isFieldDirty={editableData.isFieldDirty}
            pendingCount={editableData.pendingCount}
            isSaving={editableData.isSaving}
            onSave={editableData.saveAllChanges}
            onDiscard={editableData.discardChanges}
          />
        ) : isLoading ? (
          <div className="flex justify-center items-center p-8">
            <div className="text-lg">Generando reporte...</div>
          </div>
        ) : (
          <div className="space-y-6">
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

        {/* Exportación automática */}
        <ReportExportTokenManager />
      </div>
    </div>
  );
}
