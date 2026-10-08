import { categoryNames, type FinancialAnalysis, type monthlyTrend } from './financialCharts';
import { propertyResults, type Allocation } from './financialAnalytics';
import { financialName } from './financialFormat';
import type { Filters } from './financialModel';
import type { DirectoryEntry } from './financialSource';

export type ReportCell = string | number | null;
export interface ReportTable { id: string; name: string; headers: string[]; rows: ReportCell[][] }
export interface FinancialReportInput { result: FinancialAnalysis; filters: Filters; sedeName: string; clients: DirectoryEntry[]; properties: DirectoryEntry[]; workers: DirectoryEntry[]; buildings: DirectoryEntry[]; allocation: Allocation; rows: ReturnType<typeof monthlyTrend>; draft: boolean }
const euros = (cents: number) => cents / 100;
export function financialReportTables(input: FinancialReportInput): ReportTable[] {
  const { result, filters } = input;
  const name = (directory: DirectoryEntry[], id: string) => financialName(directory.find(entry => entry.id === id)?.name || id || 'Sin vínculo');
  const summary = (label: string, row: FinancialAnalysis['total']): ReportCell[] => [label, euros(row.revenue), euros(row.costs.personal + row.costs.salary), euros(row.costs.laundry), euros(row.costs.supplies), euros(row.costs.products), euros(row.costs.other), euros(row.expense), euros(row.result), row.margin];
  const headings = ['Concepto', 'Ingresos EUR', 'Personal y dirección EUR', 'Lavandería EUR', 'Amenities y consumibles EUR', 'Productos EUR', 'Otros EUR', 'Gastos EUR', 'Resultado EUR', 'Margen %'];
  const linkedProperties = propertyResults(result, input.properties);
  return [
    { id: 'summary', name: 'Resumen', headers: ['Campo', 'Valor'], rows: [
      ['Aplicación', 'APP GESTIÓN LIMPATEX'], ['Sede', input.sedeName], ['Desde', filters.start], ['Hasta', filters.end], ['Estado', input.draft ? 'Provisional · configuración sin guardar' : 'Provisional'], ['Moneda', 'EUR · sin IVA'],
      ['Clientes', filters.clients.map(id => name(input.clients, id)).join(', ') || 'Todos'], ['Propiedades', filters.properties.map(id => name(input.properties, id)).join(', ') || 'Todas'], ['Edificios', filters.buildings?.map(id => name(input.buildings, id)).join(', ') || 'Todos'], ['Trabajadores', filters.workers.map(id => name(input.workers, id)).join(', ') || 'Todos'], ['Tipos', filters.types?.join(', ') || 'Todos'], ['Categorías de gasto', filters.categories?.map(category => categoryNames[category]).join(', ') || 'Todas'],
      ['Reparto', { none: 'Sin repartir', revenue: 'Por ingresos', services: 'Por número de servicios' }[input.allocation]], ['Ingresos EUR', euros(result.total.revenue)], ['Gastos EUR', euros(result.total.expense)], ['Resultado EUR', euros(result.total.result)], ['Margen %', result.total.margin], ['Registros con datos pendientes', result.total.pending], ['Registros estimados', result.total.estimated], ['Servicios fuera del balance', result.excludedIncomeServices.length],
      ['Nota', 'Tarifas actuales; ingresos por fecha del servicio, no facturas ni cobros. Los costes pendientes no se estiman como cero confirmado.'], ['Alcance', filters.categories?.length ? 'Vista parcial: resultado y margen descuentan solo categorías seleccionadas.' : 'Todas las categorías de gasto incluidas.'] ] },
    { id: 'clients', name: 'Clientes', headers: headings, rows: [...result.clients.map(row => summary(name(input.clients, row.id), row)), summary('Actividad general · remanente', result.general), summary('TOTAL DEL ANÁLISIS', result.total)] },
    { id: 'properties', name: 'Propiedades', headers: [...headings, 'Servicios', 'Gasto repartido EUR'], rows: linkedProperties.map(row => [...summary(financialName(row.name), row), row.services, euros(row.allocated)]) },
    { id: 'services', name: 'Servicios', headers: ['Fecha', 'Propiedad', 'Cliente', 'Tipo', 'Equipo', ...headings.slice(1), 'Datos pendientes'], rows: result.services.map(row => [row.date, financialName(row.propertyName), name(input.clients, row.clientId), row.type, row.workers.map(worker => financialName(worker.name)).join(', '), euros(row.revenue || 0), euros(row.costs.personal), euros(row.costs.laundry), euros(row.costs.supplies), euros(row.costs.products), euros(row.costs.other), euros(row.expense), row.result === null ? null : euros(row.result), row.revenue ? (row.result || 0) / row.revenue * 100 : null, row.pending.join(' · ')]) },
    { id: 'incomes', name: 'Ingresos externos', headers: ['Fecha', 'Concepto', 'Cliente', 'Propiedad', 'Ingreso EUR', 'Gastos EUR', 'Resultado EUR', 'Datos pendientes'], rows: result.incomes.map(row => [row.date, financialName(row.propertyName), name(input.clients, row.clientId), name(input.properties, row.propertyId), euros(row.revenue || 0), euros(row.expense), euros(row.result || 0), row.pending.join(' · ')]) },
    { id: 'expenses', name: 'Gastos adicionales', headers: ['Fecha', 'Concepto', 'Categoría', 'Cliente', 'Propiedad', 'Importe EUR', 'Origen'], rows: result.expenses.map(row => [row.date, financialName(row.label), categoryNames[row.category], name(input.clients, row.clientId), name(input.properties, row.propertyId), euros(row.cents), row.id.startsWith('allocation:') ? 'Reparto de gasto general' : row.automatic ? 'Automático' : 'Manual']) },
    { id: 'months', name: 'Evolución mensual', headers: headings, rows: input.rows.map(row => summary(row.name, row)) },
    { id: 'excluded', name: 'Fuera del balance', headers: ['Fecha', 'Propiedad', 'Cliente', 'Tipo', 'Ingreso EUR', 'Motivo'], rows: result.excludedIncomeServices.map(row => [row.date, financialName(row.propertyName), name(input.clients, row.clientId), row.type, row.revenue === null ? null : euros(row.revenue), row.revenue === null ? 'Precio pendiente · sin costes imputados' : 'Ingreso cero · sin costes imputados']) },
  ];
}
// Treat CSV text as text even when a name starts with a spreadsheet formula.
export function financialCsv(table: ReportTable, metadata?: ReportTable) {
  const cell = (value: ReportCell) => {
    if (value === null) return '';
    if (typeof value === 'number') return String(Math.round(value * 10000) / 10000).replace('.', ',');
    const safe = /^\s*[=+\-@]/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const context = metadata ? metadata.rows.map(row => [`# ${row[0]}: ${row[1]}`, ...Array(Math.max(0, table.headers.length - 1)).fill(null)] as ReportCell[]) : [];
  return '\uFEFF' + [table.headers, ...table.rows, ...context].map(row => row.map(cell).join(';')).join('\r\n');
}
export async function financialExcel(tables: ReportTable[]): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  for (const table of tables) {
    const worksheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
    worksheet['!cols'] = table.headers.map((header, index) => ({ wch: Math.min(50, Math.max(header.length + 2, ...table.rows.slice(0, 150).map(row => typeof row[index] === 'string' ? String(row[index]).length + 1 : 18))) }));
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: table.headers.length - 1, r: table.rows.length } }) };
    for (let row = 1; row <= table.rows.length; row++) for (let column = 0; column < table.headers.length; column++) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (worksheet[address]?.t === 'n' && /EUR|%/.test(table.headers[column])) worksheet[address].z = '#,##0.00';
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, table.name.slice(0, 31));
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
}
