import * as XLSX from 'xlsx';
import { ClientBillingReport } from '@/types/reports';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCost = (value: number): string => {
  return value.toFixed(2).replace('.', ',');
};

export const exportClientBillingToExcel = (
  client: ClientBillingReport,
  startDate?: Date,
  endDate?: Date
) => {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: All tasks
  const taskHeaders = [
    'Propiedad',
    'Código',
    'Dirección',
    'Fecha',
    'Tipo Servicio',
    'Check-in',
    'Check-out',
    'Duración (min)',
    'Trabajador',
    'Coste (€)'
  ];

  const taskRows: (string | number)[][] = [];
  
  client.properties.forEach(property => {
    property.tasks.forEach(task => {
      taskRows.push([
        property.propertyName,
        property.propertyCode,
        property.direccion,
        format(new Date(task.date), 'dd/MM/yyyy', { locale: es }),
        task.type,
        task.checkIn || '-',
        task.checkOut || '-',
        task.duration,
        task.cleaner,
        formatCost(task.cost)
      ]);
    });
  });

  const taskSheet = XLSX.utils.aoa_to_sheet([taskHeaders, ...taskRows]);
  XLSX.utils.book_append_sheet(workbook, taskSheet, 'Detalle Servicios');

  // Sheet 2: Summary by property
  const summaryData: (string | number)[][] = [
    [`FACTURACIÓN - ${client.clientName.toUpperCase()}`],
    [`CIF/NIF: ${client.cifNif || 'N/A'}`],
    [`Dirección Facturación: ${client.direccionFacturacion || 'N/A'}`],
    [`Método de Pago: ${client.metodoPago || 'N/A'}`],
  ];

  if (startDate && endDate) {
    summaryData.push([`Período: ${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`]);
  }

  summaryData.push([]);
  summaryData.push(['RESUMEN POR PROPIEDAD']);
  summaryData.push(['Propiedad', 'Código', 'Nº Limpiezas', 'Subtotal (€)']);

  client.properties.forEach(property => {
    summaryData.push([
      property.propertyName,
      property.propertyCode,
      property.totalCleanings,
      formatCost(property.totalCost)
    ]);
  });

  summaryData.push([]);
  summaryData.push(['TOTAL', '', client.totalServices, formatCost(client.totalCost)]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  // Download file
  const filename = `facturacion_${client.clientName.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

export const exportAllClientsBillingToExcel = (
  clients: ClientBillingReport[],
  startDate?: Date,
  endDate?: Date
) => {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: All tasks from all clients
  const taskHeaders = [
    'Cliente',
    'CIF/NIF',
    'Propiedad',
    'Código',
    'Fecha',
    'Tipo',
    'Duración (min)',
    'Trabajador',
    'Coste (€)'
  ];

  const taskRows: (string | number)[][] = [];

  clients.forEach(client => {
    client.properties.forEach(property => {
      property.tasks.forEach(task => {
        taskRows.push([
          client.clientName,
          client.cifNif || 'N/A',
          property.propertyName,
          property.propertyCode,
          format(new Date(task.date), 'dd/MM/yyyy', { locale: es }),
          task.type,
          task.duration,
          task.cleaner,
          formatCost(task.cost)
        ]);
      });
    });
  });

  const taskSheet = XLSX.utils.aoa_to_sheet([taskHeaders, ...taskRows]);
  XLSX.utils.book_append_sheet(workbook, taskSheet, 'Detalle Servicios');

  // Sheet 2: Summary
  const totalServices = clients.reduce((sum, c) => sum + c.totalServices, 0);
  const totalAmount = clients.reduce((sum, c) => sum + c.totalCost, 0);

  const summaryData: (string | number)[][] = [
    ['RESUMEN DE FACTURACIÓN - TODOS LOS CLIENTES'],
  ];

  if (startDate && endDate) {
    summaryData.push([`Período: ${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`]);
  }

  summaryData.push([`Fecha de generación: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`]);
  summaryData.push([]);
  summaryData.push([`Total Clientes: ${clients.length}`]);
  summaryData.push([`Total Servicios: ${totalServices}`]);
  summaryData.push([`Total Facturado: €${formatCost(totalAmount)}`]);
  summaryData.push([]);
  summaryData.push(['RESUMEN POR CLIENTE']);
  summaryData.push(['Cliente', 'CIF/NIF', 'Nº Propiedades', 'Nº Servicios', 'Total (€)']);

  clients.forEach(client => {
    summaryData.push([
      client.clientName,
      client.cifNif || 'N/A',
      client.properties.length,
      client.totalServices,
      formatCost(client.totalCost)
    ]);
  });

  summaryData.push([]);
  summaryData.push(['TOTAL', '', '', totalServices, formatCost(totalAmount)]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  // Download file
  const filename = `facturacion_todos_clientes_${format(new Date(), 'yyyyMMdd')}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
