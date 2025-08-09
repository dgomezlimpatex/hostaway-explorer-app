import { TaskReport, BillingReport, SummaryReport, LaundryReport } from '@/types/reports';

type ReportData = TaskReport[] | BillingReport[] | SummaryReport | LaundryReport[];

// Helper function to format dates from YYYY-MM-DD to DD/MM/YYYY
const formatDateForCSV = (dateString: string): string => {
  if (!dateString || dateString === 'N/A') return dateString;
  
  // Check if it's already in DD/MM/YYYY format
  if (dateString.includes('/')) return dateString;
  
  // Convert from YYYY-MM-DD to DD/MM/YYYY
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  
  return dateString;
};

export const exportToCSV = (
  data: ReportData,
  filename: string,
  reportType: 'tasks' | 'billing' | 'summary' | 'laundry'
) => {
  let csvContent = '';
  
  switch (reportType) {
    case 'tasks':
      csvContent = generateTasksCSV(data as TaskReport[]);
      break;
    case 'billing':
      csvContent = generateBillingCSV(data as BillingReport[]);
      break;
    case 'summary':
      csvContent = generateSummaryCSV(data as SummaryReport);
      break;
    case 'laundry':
      csvContent = generateLaundryCSV(data as LaundryReport[]);
      break;
    default:
      throw new Error(`Tipo de reporte no soportado: ${reportType}`);
  }

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const generateTasksCSV = (data: TaskReport[]): string => {
  // Headers actualizados con "Cliente" entre "Supervisor" y "Tipo de servicio"
  const headers = [
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
    formatDateForCSV(task.serviceDate),
    task.supervisor,
    task.client,
    task.serviceType,
    task.taskStatus,
    task.totalCost.toFixed(2).replace('.', ','),
    task.serviceHours.toFixed(2).replace('.', ','),
    task.workTeam,
    task.paymentMethod,
    task.incidents
  ]);

  return [headers, ...rows].map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
};

const generateBillingCSV = (data: BillingReport[]): string => {
  const headers = [
    'Propiedad',
    'Cliente',
    'Fecha',
    'Servicio',
    'Duración (min)',
    'Coste (€)',
    'Estado'
  ];

  const rows = data.map(item => [
    item.property,
    item.client,
    formatDateForCSV(item.date),
    item.serviceType,
    item.duration.toString(),
    item.cost.toFixed(2),
    item.status === 'completed' ? 'Facturado' :
    item.status === 'in-progress' ? 'En Progreso' : 'Pendiente'
  ]);

  return [headers, ...rows].map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
};

const generateSummaryCSV = (data: SummaryReport): string => {
  const content = [
    ['Métrica', 'Valor'],
    ['Total Tareas', data.totalTasks.toString()],
    ['Tareas Completadas', data.completedTasks.toString()],
    ['Tareas Pendientes', data.pendingTasks.toString()],
    ['Ingresos Totales (€)', data.totalRevenue.toFixed(2)],
    ['Duración Promedio (min)', data.averageTaskDuration.toString()],
    ['', ''],
    ['Top Trabajadores', ''],
    ...data.topCleaners.map(cleaner => [cleaner.name, `${cleaner.tasks} tareas`]),
    ['', ''],
    ['Top Clientes', ''],
    ...data.topClients.map(client => [client.name, `${client.tasks} tareas`])
  ];

  return content.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
};

const generateLaundryCSV = (data: LaundryReport[]): string => {
  // Headers para el reporte de lavandería
  const headers = [
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

  // Verificar que hay datos
  if (!data || data.length === 0) {
    return headers.map(header => `"${header}"`).join(',');
  }

  const rows = data.map(item => [
    item.property || '',
    item.propertyCode || '',
    item.address || '',
    formatDateForCSV(item.date || ''),
    item.startTime || '',
    item.endTime || '',
    item.client || '',
    item.cleaner || '',
    (item.textiles?.sabanas || 0).toString(),
    (item.textiles?.sabanasRequenas || 0).toString(),
    (item.textiles?.sabanasSuite || 0).toString(),
    (item.textiles?.toallasGrandes || 0).toString(),
    (item.textiles?.toallasPequenas || 0).toString(),
    (item.textiles?.alfombrines || 0).toString(),
    (item.textiles?.fundasAlmohada || 0).toString(),
    (item.kitAlimentario || 0).toString(),
    (item.bedrooms || 0).toString(),
    (item.bedroomsSmall || 0).toString(),
    (item.bedroomsSuite || 0).toString(),
    (item.sofaBeds || 0).toString(),
    (item.bathrooms || 0).toString(),
    (item.amenitiesBano || 0).toString(),
    (item.amenitiesCocina || 0).toString(),
    (item.rollosPapelHigienico || 0).toString(),
    (item.rollosPapelCocina || 0).toString()
  ]);

  // Asegurar que los headers están incluidos
  const csvContent = [headers, ...rows].map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');

  return csvContent;
};
