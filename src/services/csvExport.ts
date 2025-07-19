import { TaskReport, BillingReport, SummaryReport, LaundryReport } from '@/types/reports';

type ReportData = TaskReport[] | BillingReport[] | SummaryReport | LaundryReport[];

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
    'Equipo de trabajo',
    'Método de pago',
    'Incidencias'
  ];

  const rows = data.map(task => [
    task.serviceDate,
    task.supervisor,
    task.client,
    task.serviceType,
    task.taskStatus,
    `€${task.totalCost.toFixed(2)}`,
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
    item.date,
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
  const headers = [
    'Propiedad',
    'Dirección',
    'Fecha',
    'Hora Inicio',
    'Hora Fin',
    'Cliente',
    'Trabajador',
    'Sábanas',
    'Toallas Grandes',
    'Toallas Pequeñas',
    'Alfombrines',
    'Fundas Almohada',
    'Kit Alimentario',
    'Habitaciones',
    'Baños',
    'Amenities Baño',
    'Amenities Cocina'
  ];

  const rows = data.map(item => [
    item.property,
    item.address,
    item.date,
    item.startTime,
    item.endTime,
    item.client,
    item.cleaner,
    item.textiles.sabanas.toString(),
    item.textiles.toallasGrandes.toString(),
    item.textiles.toallasPequenas.toString(),
    item.textiles.alfombrines.toString(),
    item.textiles.fundasAlmohada.toString(),
    item.kitAlimentario.toString(),
    item.bedrooms.toString(),
    item.bathrooms.toString(),
    item.amenitiesBano.toString(),
    item.amenitiesCocina.toString()
  ]);

  return [headers, ...rows].map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
};
