import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLogisticsReporting } from "@/hooks/useLogisticsReporting";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from "recharts";
import { Link } from "react-router-dom";
import {
  Download,
  FileText,
  BarChart3,
  TrendingUp,
  Calendar,
  Filter,
  RefreshCw,
  Target,
  Clock,
  Package,
  Truck,
  ArrowLeft
} from "lucide-react";

export const LogisticsReporting: React.FC = () => {
  const { toast } = useToast();
  const {
    isGenerating,
    generatePicklistReport,
    calculateKPIs,
    exportToExcel,
    exportToPDF
  } = useLogisticsReporting();

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: [] as string[]
  });

  const [reportData, setReportData] = useState<any[]>([]);
  const [kpiData, setKpiData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    setFilters({
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      status: []
    });
  }, []);

  const handleGenerateReport = async () => {
    if (!filters.startDate || !filters.endDate) {
      toast({
        title: "Fechas requeridas",
        description: "Selecciona un rango de fechas para generar el reporte",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const [report, kpis] = await Promise.all([
        generatePicklistReport(filters),
        calculateKPIs(filters)
      ]);
      
      setReportData(report);
      setKpiData(kpis);
    } catch (error) {
      // Error handled in hook
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (reportData.length === 0) {
      toast({
        title: "No hay datos",
        description: "Genera un reporte antes de exportar",
        variant: "destructive"
      });
      return;
    }

    await exportToExcel(reportData, `reporte-logistica-${filters.startDate}-${filters.endDate}`);
  };

  const handleExportPDF = async () => {
    if (reportData.length === 0 || !kpiData) {
      toast({
        title: "No hay datos",
        description: "Genera un reporte antes de exportar",
        variant: "destructive"
      });
      return;
    }

    await exportToPDF(reportData, kpiData, `reporte-logistica-${filters.startDate}-${filters.endDate}`);
  };

  // Chart data preparation
  const statusChartData = reportData.reduce((acc, item) => {
    const existing = acc.find(d => d.status === item.status);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ status: item.status, count: 1 });
    }
    return acc;
  }, [] as any[]);

  const timelineData = reportData.reduce((acc, item) => {
    const date = new Date(item.created_at).toISOString().split('T')[0];
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ date, count: 1 });
    }
    return acc;
  }, [] as any[]).sort((a, b) => a.date.localeCompare(b.date));

  const productivityData = reportData.map(item => ({
    code: item.code,
    items: item.items_count,
    products: item.total_products,
    efficiency: item.items_count > 0 ? (item.total_products / item.items_count) : 0
  })).slice(0, 10);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                Reportes Logística
              </h1>
              <p className="text-sm text-muted-foreground">
                Análisis y reportes de operaciones logísticas
              </p>
            </div>
          </div>
          <Button 
            onClick={handleGenerateReport} 
            disabled={loading || isGenerating}
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading || isGenerating ? 'animate-spin' : ''}`} />
            Generar Reporte
          </Button>
        </div>

        {/* Filters */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Reporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha Inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha Fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select onValueChange={(value) => setFilters(prev => ({ ...prev, status: value ? [value] : [] }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="preparing">Preparando</SelectItem>
                    <SelectItem value="packed">Empacada</SelectItem>
                    <SelectItem value="committed">Confirmada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end gap-2">
                <Button 
                  onClick={handleGenerateReport}
                  disabled={loading}
                  className="flex-1"
                >
                  <BarChart3 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Generando...' : 'Generar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {kpiData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fill Rate</p>
                    <p className="text-xl font-bold">{kpiData.fillRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Truck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">On-Time Delivery</p>
                    <p className="text-xl font-bold">{kpiData.onTimeDelivery}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Clock className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tiempo Empaque</p>
                    <p className="text-xl font-bold">{kpiData.averagePackingTime}m</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Productividad</p>
                    <p className="text-xl font-bold">{kpiData.productivityScore}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Export Actions */}
        {reportData.length > 0 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Exportar Reportes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleExportExcel}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex-1"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
                <Button 
                  onClick={handleExportPDF}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex-1"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        {reportData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle>Distribución por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle>Tendencia Temporal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Productivity Chart */}
            <Card className="shadow-lg border-0 lg:col-span-2">
              <CardHeader>
                <CardTitle>Productividad por Picklist (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="code" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="items" fill="#8884d8" name="Items" />
                    <Bar dataKey="products" fill="#82ca9d" name="Productos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data Summary */}
        {reportData.length > 0 && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle>Resumen de Datos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{reportData.length}</p>
                  <p className="text-sm text-muted-foreground">Total Picklists</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {reportData.filter(r => r.status === 'committed').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Completadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {reportData.reduce((sum, r) => sum + r.total_products, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Productos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {reportData.reduce((sum, r) => sum + r.properties_count, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Propiedades Únicas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {reportData.length === 0 && !loading && (
          <Card className="shadow-lg border-0">
            <CardContent className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">
                No hay datos de reporte
              </p>
              <p className="text-sm text-muted-foreground">
                Configura los filtros y genera un reporte para ver los análisis
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};