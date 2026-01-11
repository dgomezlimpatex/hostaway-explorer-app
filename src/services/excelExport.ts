import * as XLSX from 'xlsx';
import { TaskReport, BillingReport, SummaryReport, LaundryReport } from '@/types/reports';

type ReportData = TaskReport[] | BillingReport[] | SummaryReport | LaundryReport[];

// Helper function to format names to uppercase
const formatNameToUppercase = (name: string | undefined | null): string => {
  if (!name || name === 'N/A' || name === 'Sin asignar' || name === 'Sin supervisor') return name || '';
  return name.toUpperCase();
};

// Helper function to format dates from YYYY-MM-DD to DD/MM/YYYY
const formatDateForDisplay = (dateString: string): string => {
  if (!dateString || dateString === 'N/A') return dateString;
  
  if (dateString.includes('/')) return dateString;
  
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  
  return dateString;
};

// Helper to get date key for grouping (YYYY-MM-DD format)
const getDateKey = (dateString: string): string => {
  if (!dateString) return 'sin_fecha';
  
  // If already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return dateString.split('T')[0];
  }
  
  // If in DD/MM/YYYY format
  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  
  return dateString;
};

// Helper to format date for sheet name (DD-MM-YYYY)
const formatDateForSheetName = (dateKey: string): string => {
  const parts = dateKey.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateKey;
};

// Group data by date
const groupByDate = <T extends { date?: string; serviceDate?: string }>(
  data: T[]
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  
  data.forEach(item => {
    const dateField = (item as any).serviceDate || (item as any).date || '';
    const dateKey = getDateKey(dateField);
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(item);
  });
  
  // Sort by date
  return new Map([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])));
};

export const exportToExcel = (
  data: ReportData,
  filename: string,
  reportType: string,
  groupByDay: boolean = true
) => {
  const workbook = XLSX.utils.book_new();
  
  switch (reportType) {
    case 'tasks':
      if (groupByDay && Array.isArray(data)) {
        generateTasksExcelByDay(workbook, data as TaskReport[]);
      } else {
        const sheet = generateTasksSheet(data as TaskReport[]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Tareas');
      }
      break;
    case 'billing':
      if (groupByDay && Array.isArray(data)) {
        generateBillingExcelByDay(workbook, data as BillingReport[]);
      } else {
        const sheet = generateBillingSheet(data as BillingReport[]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Facturación');
      }
      break;
    case 'summary':
      const summarySheet = generateSummarySheet(data as SummaryReport);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
      break;
    case 'laundry':
      if (groupByDay && Array.isArray(data)) {
        generateLaundryExcelByDay(workbook, data as LaundryReport[]);
      } else {
        const sheet = generateLaundrySheet(data as LaundryReport[]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Lavandería');
      }
      break;
    default:
      throw new Error(`Tipo de reporte no soportado: ${reportType}`);
  }

  // Download the file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// Tasks Excel generation
const generateTasksSheet = (data: TaskReport[]): XLSX.WorkSheet => {
  const headers = [
    'Sede',
    'Fecha del servicio',
    'Supervisor',
    'Cliente',
    'Tipo de servicio',
    'Estado de la tarea',
    'Coste total del servicio',
    'Horas del servicio',
    'Equipo de trabajo',
    'Método de pago',
    'Incidencias'
  ];

  const rows = data.map(task => [
    task.sede || 'N/A',
    formatDateForDisplay(task.serviceDate),
    formatNameToUppercase(task.supervisor),
    task.client,
    task.serviceType,
    task.taskStatus,
    task.totalCost,
    task.serviceHours,
    formatNameToUppercase(task.workTeam),
    task.paymentMethod,
    task.incidents
  ]);

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
};

const generateTasksExcelByDay = (workbook: XLSX.WorkBook, data: TaskReport[]) => {
  const grouped = groupByDate(data);
  
  if (grouped.size === 0) {
    const sheet = generateTasksSheet([]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sin datos');
    return;
  }

  grouped.forEach((tasks, dateKey) => {
    const sheet = generateTasksSheet(tasks);
    const sheetName = formatDateForSheetName(dateKey).substring(0, 31); // Excel limit 31 chars
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });
};

// Billing Excel generation
const generateBillingSheet = (data: BillingReport[]): XLSX.WorkSheet => {
  const headers = [
    'Sede',
    'Propiedad',
    'Cliente',
    'Fecha',
    'Servicio',
    'Duración (min)',
    'Coste (€)',
    'Estado'
  ];

  const rows = data.map(item => [
    item.sede || 'N/A',
    item.property,
    item.client,
    formatDateForDisplay(item.date),
    item.serviceType,
    item.duration,
    item.cost,
    item.status === 'completed' ? 'Facturado' :
    item.status === 'in-progress' ? 'En Progreso' : 'Pendiente'
  ]);

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
};

const generateBillingExcelByDay = (workbook: XLSX.WorkBook, data: BillingReport[]) => {
  const grouped = groupByDate(data);
  
  if (grouped.size === 0) {
    const sheet = generateBillingSheet([]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sin datos');
    return;
  }

  grouped.forEach((items, dateKey) => {
    const sheet = generateBillingSheet(items);
    const sheetName = formatDateForSheetName(dateKey).substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });
};

// Summary Excel generation
const generateSummarySheet = (data: SummaryReport): XLSX.WorkSheet => {
  const content = [
    ['Métrica', 'Valor'],
    ['Total Tareas', data.totalTasks],
    ['Tareas Completadas', data.completedTasks],
    ['Tareas Pendientes', data.pendingTasks],
    ['Ingresos Totales (€)', data.totalRevenue],
    ['Duración Promedio (min)', data.averageTaskDuration],
    ['', ''],
    ['Top Trabajadores', ''],
    ...data.topCleaners.map(cleaner => [formatNameToUppercase(cleaner.name), `${cleaner.tasks} tareas`]),
    ['', ''],
    ['Top Clientes', ''],
    ...data.topClients.map(client => [client.name, `${client.tasks} tareas`])
  ];

  return XLSX.utils.aoa_to_sheet(content);
};

// Laundry Excel generation
const generateLaundrySheet = (data: LaundryReport[]): XLSX.WorkSheet => {
  const headers = [
    'Sede',
    'Propiedad',
    'Código Propiedad',
    'Dirección',
    'Fecha',
    'Hora Inicio',
    'Hora Fin',
    'Cliente',
    'Trabajador',
    'Sábanas',
    'Sábanas Pequeñas',
    'Sábanas Suite',
    'Toallas Grandes',
    'Toallas Pequeñas',
    'Alfombrines',
    'Fundas Almohada',
    'Kit Alimentario',
    'Camas',
    'Camas Pequeñas',
    'Camas Suite',
    'Sofás Cama',
    'Baños',
    'Amenities Baño',
    'Amenities Cocina',
    'Rollos Papel Higiénico',
    'Rollos Papel Cocina'
  ];

  const rows = data.map(item => [
    item.sede || 'N/A',
    item.property || '',
    item.propertyCode || '',
    item.address || '',
    formatDateForDisplay(item.date || ''),
    item.startTime || '',
    item.endTime || '',
    item.client || '',
    formatNameToUppercase(item.cleaner) || '',
    item.textiles?.sabanas || 0,
    item.textiles?.sabanasRequenas || 0,
    item.textiles?.sabanasSuite || 0,
    item.textiles?.toallasGrandes || 0,
    item.textiles?.toallasPequenas || 0,
    item.textiles?.alfombrines || 0,
    item.textiles?.fundasAlmohada || 0,
    item.kitAlimentario || 0,
    item.bedrooms || 0,
    item.bedroomsSmall || 0,
    item.bedroomsSuite || 0,
    item.sofaBeds || 0,
    item.bathrooms || 0,
    item.amenitiesBano || 0,
    item.amenitiesCocina || 0,
    item.rollosPapelHigienico || 0,
    item.rollosPapelCocina || 0
  ]);

  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
};

const generateLaundryExcelByDay = (workbook: XLSX.WorkBook, data: LaundryReport[]) => {
  const grouped = groupByDate(data);
  
  if (grouped.size === 0) {
    const sheet = generateLaundrySheet([]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sin datos');
    return;
  }

  grouped.forEach((items, dateKey) => {
    const sheet = generateLaundrySheet(items);
    const sheetName = formatDateForSheetName(dateKey).substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });
};
