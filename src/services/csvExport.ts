
import { TaskReport, BillingReport, SummaryReport } from '@/types/reports';

export const exportToCSV = (data: any[], filename: string, type: 'tasks' | 'billing' | 'summary') => {
  let csvContent = '';
  
  switch (type) {
    case 'tasks':
      csvContent = exportTasksToCSV(data as TaskReport[]);
      break;
    case 'billing':
      csvContent = exportBillingToCSV(data as BillingReport[]);
      break;
    case 'summary':
      csvContent = exportSummaryToCSV(data as SummaryReport);
      break;
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const exportTasksToCSV = (tasks: TaskReport[]): string => {
  const headers = [
    'ID',
    'Propiedad',
    'Dirección',
    'Fecha',
    'Hora Inicio',
    'Hora Fin',
    'Tipo',
    'Estado',
    'Trabajador',
    'Cliente'
  ];
  
  const rows = tasks.map(task => [
    task.id,
    task.property,
    task.address,
    task.date,
    task.startTime,
    task.endTime,
    task.type,
    task.status,
    task.cleaner,
    task.client
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(field => `"${field}"`).join(',')
  ).join('\n');
};

const exportBillingToCSV = (billing: BillingReport[]): string => {
  const headers = [
    'ID',
    'Propiedad',
    'Cliente',
    'Fecha',
    'Tipo Servicio',
    'Duración (min)',
    'Coste (€)',
    'Estado'
  ];
  
  const rows = billing.map(item => [
    item.id,
    item.property,
    item.client,
    item.date,
    item.serviceType,
    item.duration.toString(),
    item.cost.toString(),
    item.status
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(field => `"${field}"`).join(',')
  ).join('\n');
};

const exportSummaryToCSV = (summary: SummaryReport): string => {
  const data = [
    ['Métrica', 'Valor'],
    ['Total Tareas', summary.totalTasks.toString()],
    ['Tareas Completadas', summary.completedTasks.toString()],
    ['Tareas Pendientes', summary.pendingTasks.toString()],
    ['Ingresos Totales', summary.totalRevenue.toString()],
    ['Duración Promedio', summary.averageTaskDuration.toString()],
    ['', ''],
    ['Top Trabajadores', ''],
    ...summary.topCleaners.map(cleaner => [cleaner.name, cleaner.tasks.toString()])
  ];
  
  return data.map(row => 
    row.map(field => `"${field}"`).join(',')
  ).join('\n');
};
