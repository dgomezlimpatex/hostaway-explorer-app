import React, { useState, useMemo } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { MobileDashboardHeader } from '@/components/dashboard/MobileDashboardHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLinenControl, LinenStatus, PropertyLinenStatus } from '@/hooks/useLinenControl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search, CheckCircle2, AlertCircle, Clock, RefreshCw, Building2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const statusConfig: Record<LinenStatus, { label: string; color: string; icon: React.ReactNode }> = {
  clean: {
    label: 'Muda limpia',
    color: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  'needs-linen': {
    label: 'Necesita muda',
    color: 'bg-red-500',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  overdue: {
    label: 'Atrasado',
    color: 'bg-red-700',
    icon: <Clock className="h-4 w-4" />,
  },
};

const LinenControlPage = () => {
  const isMobile = useIsMobile();
  const { propertyStatuses, stats, isLoading } = useLinenControl();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LinenStatus | 'all'>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');

  // Get unique building codes for filter
  const buildingCodes = useMemo(() => {
    const codes = [...new Set(propertyStatuses.map(p => p.buildingCode))];
    return codes.sort();
  }, [propertyStatuses]);

  // Filter properties
  const filteredProperties = useMemo(() => {
    return propertyStatuses.filter(property => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        property.propertyCode.toLowerCase().includes(searchLower) ||
        property.propertyName.toLowerCase().includes(searchLower) ||
        property.clientName.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = statusFilter === 'all' || property.status === statusFilter;

      // Building filter
      const matchesBuilding = buildingFilter === 'all' || property.buildingCode === buildingFilter;

      return matchesSearch && matchesStatus && matchesBuilding;
    });
  }, [propertyStatuses, searchTerm, statusFilter, buildingFilter]);

  // Group by building
  const groupedByBuilding = useMemo(() => {
    const groups: Record<string, PropertyLinenStatus[]> = {};
    filteredProperties.forEach(property => {
      if (!groups[property.buildingCode]) {
        groups[property.buildingCode] = [];
      }
      groups[property.buildingCode].push(property);
    });
    return groups;
  }, [filteredProperties]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), "d MMM HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatNextCleaning = (nextCleaning: PropertyLinenStatus['nextCleaning']) => {
    if (!nextCleaning) return { date: '-', cleaner: '-' };
    const dateStr = format(parseISO(nextCleaning.date), "d MMM", { locale: es });
    return {
      date: `${dateStr} ${nextCleaning.time}`,
      cleaner: nextCleaning.cleanerName,
    };
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background">
        <MobileDashboardHeader />
        
        <div className="flex min-h-screen w-full">
          {!isMobile && <DashboardSidebar />}
          
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Control de Mudas</h1>
                    <p className="text-muted-foreground">Estado de ropa limpia por apartamento</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{stats.total}</div>
                      <p className="text-sm text-muted-foreground">Total apartamentos</p>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-emerald-600">{stats.clean}</div>
                      <p className="text-sm text-emerald-600/80">Con muda limpia</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-red-600">{stats.needsLinen}</div>
                      <p className="text-sm text-red-600/80">Necesitan muda</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-300 bg-red-100 dark:bg-red-900/20">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-red-700">{stats.overdue}</div>
                      <p className="text-sm text-red-700/80">Atrasados</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Filters */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por código, nombre o cliente..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LinenStatus | 'all')}>
                        <SelectTrigger className="w-full md:w-[180px]">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          <SelectItem value="clean">Muda limpia</SelectItem>
                          <SelectItem value="needs-linen">Necesita muda</SelectItem>
                          <SelectItem value="overdue">Atrasados</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                          <SelectValue placeholder="Edificio" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los edificios</SelectItem>
                          {buildingCodes.map(code => (
                            <SelectItem key={code} value={code}>{code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Table */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[50px]">Estado</TableHead>
                              <TableHead>Código</TableHead>
                              <TableHead className="hidden md:table-cell">Edificio</TableHead>
                              <TableHead className="hidden lg:table-cell">Cliente</TableHead>
                              <TableHead>Última entrega</TableHead>
                              <TableHead>Próxima limpieza</TableHead>
                              <TableHead className="hidden md:table-cell">Limpiador/a</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProperties.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                  No se encontraron apartamentos
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredProperties.map((property) => {
                                const config = statusConfig[property.status];
                                const nextCleaning = formatNextCleaning(property.nextCleaning);
                                
                                return (
                                  <TableRow 
                                    key={property.propertyId}
                                    className={cn(
                                      property.status === 'needs-linen' && 'bg-red-50 dark:bg-red-950/20',
                                      property.status === 'overdue' && 'bg-red-100 dark:bg-red-900/30'
                                    )}
                                  >
                                    <TableCell>
                                      <div 
                                        className={cn(
                                          "w-8 h-8 rounded-full flex items-center justify-center text-white",
                                          config.color
                                        )}
                                        title={config.label}
                                      >
                                        {config.icon}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{property.propertyCode}</div>
                                      <div className="text-xs text-muted-foreground md:hidden">
                                        {property.buildingCode}
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                      <Badge variant="outline" className="font-mono">
                                        <Building2 className="h-3 w-3 mr-1" />
                                        {property.buildingCode}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                                      {property.clientName}
                                    </TableCell>
                                    <TableCell>
                                      {property.lastDelivery ? (
                                        <div>
                                          <div className="text-sm">{formatDate(property.lastDelivery.date)}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {property.lastDelivery.deliveredBy}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {property.nextCleaning ? (
                                        <div>
                                          <div className={cn(
                                            "text-sm font-medium",
                                            property.cleaningStarted && "text-red-600"
                                          )}>
                                            {nextCleaning.date}
                                          </div>
                                          <div className="text-xs text-muted-foreground md:hidden">
                                            {nextCleaning.cleaner}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">Sin programar</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-muted-foreground">
                                      {nextCleaning.cleaner}
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Summary by building */}
                {!isLoading && Object.keys(groupedByBuilding).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Resumen por Edificio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Object.entries(groupedByBuilding).map(([buildingCode, properties]) => {
                          const needsAttention = properties.filter(p => p.status !== 'clean').length;
                          const allClean = needsAttention === 0;
                          
                          return (
                            <div
                              key={buildingCode}
                              className={cn(
                                "p-3 rounded-lg border text-center",
                                allClean 
                                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" 
                                  : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                              )}
                            >
                              <div className="font-mono font-bold text-lg">{buildingCode}</div>
                              <div className={cn(
                                "text-sm",
                                allClean ? "text-emerald-600" : "text-red-600"
                              )}>
                                {allClean ? (
                                  <span className="flex items-center justify-center gap-1">
                                    <CheckCircle2 className="h-4 w-4" />
                                    OK
                                  </span>
                                ) : (
                                  <span className="flex items-center justify-center gap-1">
                                    <AlertCircle className="h-4 w-4" />
                                    {needsAttention} pendiente{needsAttention > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default LinenControlPage;
