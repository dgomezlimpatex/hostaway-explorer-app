
import { ClientBillingReport } from '@/types/reports';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const exportClientBillingToCSV = (
  client: ClientBillingReport,
  startDate?: Date,
  endDate?: Date
) => {
  const lines: string[] = [];

  // Header with client info
  lines.push(`FACTURACIÓN - ${client.clientName.toUpperCase()}`);
  lines.push(`CIF/NIF: ${client.cifNif || 'N/A'}`);
  lines.push(`Dirección Facturación: ${client.direccionFacturacion || 'N/A'}`);
  lines.push(`Método de Pago: ${client.metodoPago || 'N/A'}`);
  
  if (startDate && endDate) {
    lines.push(`Período: ${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`);
  }
  
  lines.push('');
  lines.push(`Total Servicios: ${client.totalServices}`);
  lines.push(`Total Facturado: €${client.totalCost.toFixed(2)}`);
  lines.push('');

  // Column headers
  lines.push('Propiedad,Código,Dirección,Fecha,Tipo Servicio,Check-in,Check-out,Duración (min),Trabajador,Coste (€)');

  // Data rows
  client.properties.forEach(property => {
    property.tasks.forEach(task => {
      const row = [
        `"${property.propertyName}"`,
        property.propertyCode,
        `"${property.direccion}"`,
        format(new Date(task.date), 'dd/MM/yyyy', { locale: es }),
        task.type,
        task.checkIn || '-',
        task.checkOut || '-',
        task.duration.toString(),
        `"${task.cleaner}"`,
        task.cost.toFixed(2),
      ];
      lines.push(row.join(','));
    });
  });

  // Add subtotals per property
  lines.push('');
  lines.push('RESUMEN POR PROPIEDAD');
  lines.push('Propiedad,Código,Nº Limpiezas,Subtotal (€)');
  
  client.properties.forEach(property => {
    lines.push(`"${property.propertyName}",${property.propertyCode},${property.totalCleanings},${property.totalCost.toFixed(2)}`);
  });

  lines.push('');
  lines.push(`TOTAL,,${client.totalServices},${client.totalCost.toFixed(2)}`);

  // Create and download file
  const csvContent = '\uFEFF' + lines.join('\n'); // Add BOM for Excel
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const filename = `facturacion_${client.clientName.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd')}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportAllClientsBillingToCSV = (
  clients: ClientBillingReport[],
  startDate?: Date,
  endDate?: Date
) => {
  const lines: string[] = [];

  // Header
  lines.push('RESUMEN DE FACTURACIÓN - TODOS LOS CLIENTES');
  
  if (startDate && endDate) {
    lines.push(`Período: ${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`);
  }
  
  lines.push(`Fecha de generación: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`);
  lines.push('');

  // Summary
  const totalServices = clients.reduce((sum, c) => sum + c.totalServices, 0);
  const totalAmount = clients.reduce((sum, c) => sum + c.totalCost, 0);
  
  lines.push(`Total Clientes: ${clients.length}`);
  lines.push(`Total Servicios: ${totalServices}`);
  lines.push(`Total Facturado: €${totalAmount.toFixed(2)}`);
  lines.push('');

  // Column headers
  lines.push('Cliente,CIF/NIF,Propiedad,Código,Fecha,Tipo,Duración (min),Trabajador,Coste (€)');

  // All data
  clients.forEach(client => {
    client.properties.forEach(property => {
      property.tasks.forEach(task => {
        const row = [
          `"${client.clientName}"`,
          client.cifNif || 'N/A',
          `"${property.propertyName}"`,
          property.propertyCode,
          format(new Date(task.date), 'dd/MM/yyyy', { locale: es }),
          task.type,
          task.duration.toString(),
          `"${task.cleaner}"`,
          task.cost.toFixed(2),
        ];
        lines.push(row.join(','));
      });
    });
  });

  // Create and download
  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const filename = `facturacion_todos_clientes_${format(new Date(), 'yyyyMMdd')}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
