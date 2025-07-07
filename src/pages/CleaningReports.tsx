import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Filter, RefreshCw } from 'lucide-react';
import { CleaningReportsDashboard } from '@/components/cleaning-reports/CleaningReportsDashboard';
import { CleaningReportsGallery } from '@/components/cleaning-reports/CleaningReportsGallery';
import { CleaningReportsIncidents } from '@/components/cleaning-reports/CleaningReportsIncidents';
import { CleaningReportsAnalytics } from '@/components/cleaning-reports/CleaningReportsAnalytics';
import { CleaningReportsFilters } from '@/components/cleaning-reports/CleaningReportsFilters';
import { useTaskReports } from '@/hooks/useTaskReports';

export default function CleaningReports() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'today',
    cleaner: 'all',
    status: 'all',
    property: 'all',
    hasIncidents: 'all'
  });

  const { reports, isLoading } = useTaskReports();

  const handleExportReports = () => {
    // TODO: Implementar exportación
    console.log('Exporting reports with filters:', filters);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                📋 Dashboard de Reportes de Limpieza
              </h1>
              <p className="text-gray-600">
                Control completo de todos los reportes y evidencias de limpieza
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportReports}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <CleaningReportsFilters
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
            <TabsTrigger value="incidents">⚠️ Incidencias</TabsTrigger>
            <TabsTrigger value="gallery">📸 Galería</TabsTrigger>
            <TabsTrigger value="analytics">📈 Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <CleaningReportsDashboard filters={filters} />
          </TabsContent>

          <TabsContent value="incidents" className="space-y-6">
            <CleaningReportsIncidents filters={filters} />
          </TabsContent>

          <TabsContent value="gallery" className="space-y-6">
            <CleaningReportsGallery filters={filters} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <CleaningReportsAnalytics filters={filters} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}