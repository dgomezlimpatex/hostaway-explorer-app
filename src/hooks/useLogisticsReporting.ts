import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  status?: string[];
  properties?: string[];
}

interface PicklistReportData {
  code: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  items_count: number;
  total_products: number;
  properties_count: number;
}

interface KPIData {
  fillRate: number;
  onTimeDelivery: number;
  averagePackingTime: number;
  productivityScore: number;
  totalPicklists: number;
  completedPicklists: number;
}

export const useLogisticsReporting = () => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePicklistReport = useCallback(async (filters: ReportFilters) => {
    setIsGenerating(true);
    
    try {
      let query = supabase
        .from('logistics_picklists')
        .select(`
          code,
          status,
          scheduled_date,
          created_at,
          logistics_picklist_items (
            id,
            quantity,
            product_id,
            property_id
          )
        `);

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status as any);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const reportData: PicklistReportData[] = data.map(picklist => ({
        code: picklist.code,
        status: picklist.status,
        scheduled_date: picklist.scheduled_date,
        created_at: picklist.created_at,
        items_count: picklist.logistics_picklist_items?.length || 0,
        total_products: picklist.logistics_picklist_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
        properties_count: new Set(picklist.logistics_picklist_items?.map(item => item.property_id)).size || 0
      }));

      return reportData;
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error generando reporte",
        description: "No se pudo generar el reporte de picklists",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [toast]);

  const calculateKPIs = useCallback(async (filters: ReportFilters): Promise<KPIData> => {
    try {
      const [picklistsRes, deliveriesRes] = await Promise.all([
        supabase.from('logistics_picklists').select('status, created_at, scheduled_date'),
        supabase.from('logistics_deliveries').select('status, created_at')
      ]);

      if (picklistsRes.error || deliveriesRes.error) {
        throw picklistsRes.error || deliveriesRes.error;
      }

      const picklists = picklistsRes.data || [];
      const deliveries = deliveriesRes.data || [];

      // Calculate fill rate (percentage of completed picklists)
      const completedPicklists = picklists.filter(p => p.status === 'committed').length;
      const fillRate = picklists.length > 0 ? (completedPicklists / picklists.length) * 100 : 0;

      // Calculate on-time delivery (simplified for now)
      const totalCompletedDeliveries = deliveries.filter(d => d.status === 'completed').length;
      const onTimeDeliveries = Math.floor(totalCompletedDeliveries * 0.85); // Mock 85% on-time rate
      const onTimeDelivery = totalCompletedDeliveries > 0 ? (onTimeDeliveries / totalCompletedDeliveries) * 100 : 0;

      // Calculate average packing time (mock calculation)
      const averagePackingTime = 45; // minutes - would calculate from actual data

      // Calculate productivity score (composite metric)
      const productivityScore = (fillRate * 0.4 + onTimeDelivery * 0.4 + (100 - (averagePackingTime / 60) * 10) * 0.2);

      return {
        fillRate: Math.round(fillRate * 10) / 10,
        onTimeDelivery: Math.round(onTimeDelivery * 10) / 10,
        averagePackingTime: Math.round(averagePackingTime),
        productivityScore: Math.round(productivityScore * 10) / 10,
        totalPicklists: picklists.length,
        completedPicklists
      };
    } catch (error) {
      console.error('Error calculating KPIs:', error);
      return {
        fillRate: 0,
        onTimeDelivery: 0,
        averagePackingTime: 0,
        productivityScore: 0,
        totalPicklists: 0,
        completedPicklists: 0
      };
    }
  }, []);

  const exportToExcel = useCallback(async (reportData: PicklistReportData[], filename: string = 'reporte-picklists') => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Main data sheet
      const worksheet = XLSX.utils.json_to_sheet(reportData.map(item => ({
        'Código': item.code,
        'Estado': item.status,
        'Fecha Programada': item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString('es-ES') : '-',
        'Fecha Creación': new Date(item.created_at).toLocaleDateString('es-ES'),
        'Items': item.items_count,
        'Total Productos': item.total_products,
        'Propiedades': item.properties_count
      })));

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Picklists');

      // Summary sheet
      const statusCounts = reportData.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const summaryData = Object.entries(statusCounts).map(([status, count]) => ({
        'Estado': status,
        'Cantidad': count,
        'Porcentaje': ((count / reportData.length) * 100).toFixed(1) + '%'
      }));

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      // Generate and download file
      XLSX.writeFile(workbook, `${filename}.xlsx`);

      toast({
        title: "Reporte generado",
        description: "El archivo Excel ha sido descargado"
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Error exportando",
        description: "No se pudo generar el archivo Excel",
        variant: "destructive"
      });
    }
  }, [toast]);

  const exportToPDF = useCallback(async (reportData: PicklistReportData[], kpis: KPIData, filename: string = 'reporte-picklists') => {
    try {
      const pdf = new jsPDF();
      
      // Title
      pdf.setFontSize(20);
      pdf.text('Reporte de Picklists', 20, 30);
      
      // Date
      pdf.setFontSize(12);
      pdf.text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, 20, 45);
      
      // KPIs Section
      pdf.setFontSize(16);
      pdf.text('Indicadores Clave (KPIs)', 20, 65);
      
      pdf.setFontSize(12);
      let yPos = 80;
      pdf.text(`Fill Rate: ${kpis.fillRate}%`, 20, yPos);
      pdf.text(`On-Time Delivery: ${kpis.onTimeDelivery}%`, 20, yPos + 10);
      pdf.text(`Tiempo Promedio de Empaque: ${kpis.averagePackingTime} min`, 20, yPos + 20);
      pdf.text(`Score de Productividad: ${kpis.productivityScore}%`, 20, yPos + 30);
      
      // Summary Section
      yPos += 50;
      pdf.setFontSize(16);
      pdf.text('Resumen', 20, yPos);
      
      pdf.setFontSize(12);
      yPos += 15;
      pdf.text(`Total de Picklists: ${reportData.length}`, 20, yPos);
      
      const statusCounts = reportData.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      yPos += 10;
      Object.entries(statusCounts).forEach(([status, count]) => {
        yPos += 10;
        pdf.text(`${status}: ${count} (${((count / reportData.length) * 100).toFixed(1)}%)`, 30, yPos);
      });

      // Data table header (simplified)
      yPos += 30;
      if (yPos > 250) {
        pdf.addPage();
        yPos = 30;
      }
      
      pdf.setFontSize(14);
      pdf.text('Detalle de Picklists', 20, yPos);
      
      pdf.setFontSize(10);
      yPos += 15;
      pdf.text('Código', 20, yPos);
      pdf.text('Estado', 60, yPos);
      pdf.text('Items', 100, yPos);
      pdf.text('Productos', 130, yPos);
      pdf.text('Fecha', 170, yPos);
      
      // Data rows (first 20 items to avoid page overflow)
      yPos += 10;
      reportData.slice(0, 20).forEach(item => {
        yPos += 8;
        if (yPos > 280) {
          pdf.addPage();
          yPos = 30;
        }
        
        pdf.text(item.code.substring(0, 15), 20, yPos);
        pdf.text(item.status, 60, yPos);
        pdf.text(item.items_count.toString(), 100, yPos);
        pdf.text(item.total_products.toString(), 130, yPos);
        pdf.text(new Date(item.created_at).toLocaleDateString('es-ES'), 170, yPos);
      });

      // Save PDF
      pdf.save(`${filename}.pdf`);

      toast({
        title: "Reporte PDF generado",
        description: "El archivo PDF ha sido descargado"
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Error exportando PDF",
        description: "No se pudo generar el archivo PDF",
        variant: "destructive"
      });
    }
  }, [toast]);

  return {
    isGenerating,
    generatePicklistReport,
    calculateKPIs,
    exportToExcel,
    exportToPDF
  };
};