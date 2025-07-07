import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface AnalyticsData {
  generalMetrics: {
    totalReports: number;
    completedReports: number;
    avgCompletionRate: number;
    qualityScore: number;
    avgCleaningTimeMinutes: number;
    reportsWithIncidents: number;
  };
  cleanerPerformance: Array<{
    id: string;
    name: string;
    totalReports: number;
    completedReports: number;
    completionRate: number;
    reportsWithIncidents: number;
    qualityScore: number;
    avgTimeMinutes: number;
  }>;
  dailyTrends: Array<{
    date: string;
    fullDate: Date;
    total: number;
    completed: number;
    withIncidents: number;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    createdAt: string;
    resolvedAt?: string;
    property: string;
    cleanerName: string;
  }>;
}

export class AnalyticsExportService {
  static exportToExcel(data: AnalyticsData, filename?: string) {
    const workbook = XLSX.utils.book_new();
    
    // Hoja 1: Métricas Generales
    const generalMetricsData = [
      ['Métrica', 'Valor'],
      ['Total de Reportes', data.generalMetrics.totalReports],
      ['Reportes Completados', data.generalMetrics.completedReports],
      ['Tasa de Finalización (%)', data.generalMetrics.avgCompletionRate.toFixed(2)],
      ['Puntuación de Calidad (%)', data.generalMetrics.qualityScore.toFixed(2)],
      ['Tiempo Promedio (min)', data.generalMetrics.avgCleaningTimeMinutes],
      ['Reportes con Incidencias', data.generalMetrics.reportsWithIncidents],
    ];
    
    const generalWs = XLSX.utils.aoa_to_sheet(generalMetricsData);
    XLSX.utils.book_append_sheet(workbook, generalWs, 'Métricas Generales');
    
    // Hoja 2: Rendimiento por Limpiador
    const cleanerData = [
      ['Limpiador', 'Total Reportes', 'Completados', 'Tasa Finalización (%)', 'Calidad (%)', 'Tiempo Promedio (min)', 'Incidencias'],
      ...data.cleanerPerformance.map(cleaner => [
        cleaner.name,
        cleaner.totalReports,
        cleaner.completedReports,
        cleaner.completionRate.toFixed(2),
        cleaner.qualityScore.toFixed(2),
        cleaner.avgTimeMinutes,
        cleaner.reportsWithIncidents,
      ])
    ];
    
    const cleanerWs = XLSX.utils.aoa_to_sheet(cleanerData);
    XLSX.utils.book_append_sheet(workbook, cleanerWs, 'Rendimiento Limpiadores');
    
    // Hoja 3: Tendencias Diarias
    const trendsData = [
      ['Fecha', 'Total Reportes', 'Completados', 'Con Incidencias', 'Tasa Finalización (%)'],
      ...data.dailyTrends.map(day => [
        day.date,
        day.total,
        day.completed,
        day.withIncidents,
        day.total > 0 ? ((day.completed / day.total) * 100).toFixed(2) : '0.00',
      ])
    ];
    
    const trendsWs = XLSX.utils.aoa_to_sheet(trendsData);
    XLSX.utils.book_append_sheet(workbook, trendsWs, 'Tendencias Diarias');
    
    // Hoja 4: Incidencias
    if (data.incidents.length > 0) {
      const incidentsData = [
        ['ID', 'Título', 'Severidad', 'Estado', 'Fecha Creación', 'Fecha Resolución', 'Propiedad', 'Limpiador'],
        ...data.incidents.map(incident => [
          incident.id,
          incident.title,
          incident.severity,
          incident.status,
          incident.createdAt,
          incident.resolvedAt || 'Sin resolver',
          incident.property,
          incident.cleanerName,
        ])
      ];
      
      const incidentsWs = XLSX.utils.aoa_to_sheet(incidentsData);
      XLSX.utils.book_append_sheet(workbook, incidentsWs, 'Incidencias');
    }
    
    // Exportar archivo
    const fileName = filename || `analytics-reportes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }
  
  static exportToPDF(data: AnalyticsData, filename?: string) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Configuración de fuentes y colores
    doc.setFont('helvetica');
    
    // Título principal
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Dashboard de Reportes de Limpieza', 20, 30);
    
    // Fecha del reporte
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 20, 40);
    
    let yPosition = 60;
    
    // Métricas Generales
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('Métricas Generales', 20, yPosition);
    yPosition += 15;
    
    doc.setFontSize(11);
    const metrics = [
      `Total de Reportes: ${data.generalMetrics.totalReports}`,
      `Reportes Completados: ${data.generalMetrics.completedReports}`,
      `Tasa de Finalización: ${data.generalMetrics.avgCompletionRate.toFixed(1)}%`,
      `Puntuación de Calidad: ${data.generalMetrics.qualityScore.toFixed(1)}%`,
      `Tiempo Promedio: ${data.generalMetrics.avgCleaningTimeMinutes} minutos`,
      `Reportes con Incidencias: ${data.generalMetrics.reportsWithIncidents}`,
    ];
    
    metrics.forEach(metric => {
      doc.text(metric, 25, yPosition);
      yPosition += 8;
    });
    
    yPosition += 10;
    
    // Top 5 Limpiadores
    doc.setFontSize(16);
    doc.text('Top 5 Limpiadores por Calidad', 20, yPosition);
    yPosition += 15;
    
    doc.setFontSize(10);
    const topCleaners = data.cleanerPerformance.slice(0, 5);
    
    topCleaners.forEach((cleaner, index) => {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 30;
      }
      
      doc.text(`${index + 1}. ${cleaner.name}`, 25, yPosition);
      yPosition += 6;
      doc.text(`   Calidad: ${cleaner.qualityScore.toFixed(1)}% | Reportes: ${cleaner.totalReports} | Tiempo: ${cleaner.avgTimeMinutes}min`, 25, yPosition);
      yPosition += 10;
    });
    
    // Agregar nueva página si es necesario
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 30;
    }
    
    // Tendencias de los últimos 7 días
    yPosition += 10;
    doc.setFontSize(16);
    doc.text('Tendencias Últimos 7 Días', 20, yPosition);
    yPosition += 15;
    
    doc.setFontSize(10);
    data.dailyTrends.forEach(day => {
      const completionRate = day.total > 0 ? ((day.completed / day.total) * 100).toFixed(1) : '0.0';
      doc.text(`${day.date}: ${day.total} reportes (${completionRate}% completados)`, 25, yPosition);
      yPosition += 8;
    });
    
    // Resumen de incidencias si existen
    if (data.incidents.length > 0) {
      yPosition += 15;
      doc.setFontSize(16);
      doc.text('Resumen de Incidencias', 20, yPosition);
      yPosition += 15;
      
      doc.setFontSize(11);
      const openIncidents = data.incidents.filter(i => i.status === 'open').length;
      const resolvedIncidents = data.incidents.filter(i => i.status === 'resolved').length;
      
      doc.text(`Total de Incidencias: ${data.incidents.length}`, 25, yPosition);
      yPosition += 8;
      doc.text(`Incidencias Abiertas: ${openIncidents}`, 25, yPosition);
      yPosition += 8;
      doc.text(`Incidencias Resueltas: ${resolvedIncidents}`, 25, yPosition);
    }
    
    // Pie de página
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Dashboard de Reportes de Limpieza - Reporte Automatizado', 20, pageHeight - 20);
    
    // Guardar PDF
    const fileName = filename || `reporte-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  }
  
  static exportIncidentsToExcel(incidents: any[], filename?: string) {
    const workbook = XLSX.utils.book_new();
    
    const incidentsData = [
      ['ID', 'Título', 'Descripción', 'Severidad', 'Estado', 'Categoría', 'Ubicación', 'Fecha Creación', 'Fecha Resolución', 'Asignado a', 'Notas de Resolución'],
      ...incidents.map(incident => [
        incident.id,
        incident.title,
        incident.description,
        incident.severity,
        incident.status,
        incident.category,
        incident.location,
        format(new Date(incident.createdAt), 'dd/MM/yyyy HH:mm'),
        incident.resolvedAt ? format(new Date(incident.resolvedAt), 'dd/MM/yyyy HH:mm') : 'Sin resolver',
        incident.assignedTo || 'Sin asignar',
        incident.resolutionNotes || '',
      ])
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(incidentsData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Incidencias');
    
    const fileName = filename || `incidencias-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }
}

export default AnalyticsExportService;