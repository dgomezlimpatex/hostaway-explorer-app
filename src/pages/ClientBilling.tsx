
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ClientBillingFilters } from '@/components/billing/ClientBillingFilters';
import { ClientBillingReportTable } from '@/components/billing/ClientBillingReportTable';
import { useClientBillingReport } from '@/hooks/reports/useClientBillingReport';
import { exportClientBillingToExcel, exportAllClientsBillingToExcel } from '@/services/clientBillingExcelExport';
import { ClientBillingReport as ClientBillingReportType } from '@/types/reports';
import { Download, Home, Receipt } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

type DateRangeType = 'today' | 'week' | 'month' | 'custom' | 'all';

interface BillingFilters {
  dateRange: DateRangeType;
  startDate?: Date;
  endDate?: Date;
  clientId?: string;
}

export default function ClientBilling() {
  const today = new Date();
  const [filters, setFilters] = useState<BillingFilters>({
    dateRange: 'month',
    startDate: startOfMonth(today),
    endDate: endOfMonth(today),
    clientId: undefined as string | undefined,
  });

  const { data: reportData, isLoading } = useClientBillingReport(filters);

  const handleExportClient = (client: ClientBillingReportType) => {
    try {
      exportClientBillingToExcel(client, filters.startDate, filters.endDate);
      toast.success(`Excel exportado para ${client.clientName}`);
    } catch (error) {
      toast.error('Error al exportar Excel');
    }
  };

  const handleExportAll = () => {
    if (!reportData || reportData.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    try {
      exportAllClientsBillingToExcel(reportData, filters.startDate, filters.endDate);
      toast.success('Excel exportado con todos los clientes');
    } catch (error) {
      toast.error('Error al exportar Excel');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Facturación por Cliente
              </h1>
              <p className="text-muted-foreground">
                Resumen de servicios completados agrupados por cliente y propiedad
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleExportAll} 
              disabled={!reportData || reportData.length === 0 || isLoading}
              variant="default"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Todo
            </Button>
            <Link to="/">
              <Button variant="outline">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <ClientBillingFilters filters={filters} onFiltersChange={setFilters} />

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Cargando datos de facturación...</p>
            </div>
          </div>
        ) : (
          <ClientBillingReportTable 
            data={reportData || []} 
            onExportClient={handleExportClient}
          />
        )}
      </div>
    </div>
  );
}
