import React, { useState, Suspense, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Filter, RefreshCw } from 'lucide-react';
import { CleaningReportsFilters } from '@/components/cleaning-reports/CleaningReportsFilters';
import { 
  LazyCleaningReportsDashboard,
  LazyCleaningReportsIncidents,
  LazyCleaningReportsGallery,
  LazyCleaningReportsAnalytics
} from '@/components/cleaning-reports/LazyCleaningReportsComponents';
import { Skeleton } from '@/components/ui/skeleton';

export default function CleaningReports() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    cleaner: 'all',
    status: 'all',
    property: 'all',
    hasIncidents: 'all'
  });

  const handleExportReports = useCallback(() => {
    // TODO: Implementar exportación
    console.log('Exporting reports with filters:', filters);
  }, [filters]);

  // Componente de loading optimizado
  const LoadingComponent = useCallback(() => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  ), []);

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
            <Suspense fallback={<LoadingComponent />}>
              <LazyCleaningReportsDashboard filters={filters} />
            </Suspense>
          </TabsContent>

          <TabsContent value="incidents" className="space-y-6">
            <Suspense fallback={<LoadingComponent />}>
              <LazyCleaningReportsIncidents filters={filters} />
            </Suspense>
          </TabsContent>

          <TabsContent value="gallery" className="space-y-6">
            <Suspense fallback={<LoadingComponent />}>
              <LazyCleaningReportsGallery filters={filters} />
            </Suspense>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Suspense fallback={<LoadingComponent />}>
              <LazyCleaningReportsAnalytics filters={filters} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}