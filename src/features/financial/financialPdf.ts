import { jsPDF } from 'jspdf';
import { financialReportTables, type FinancialReportInput, type ReportCell } from './financialReporting';
import { financialName, money, percent } from './financialFormat';

export function financialPdf(input: FinancialReportInput): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: 'Análisis financiero - APP GESTIÓN LIMPATEX', subject: `${input.filters.start} - ${input.filters.end} · sin IVA · provisional` });
  const width = 297, height = 210, margin = 14, contentWidth = width - 2 * margin;
  let y = 28;
  const clean = (text: string) => text.replace(/\u00a0/g, ' ').replace(/[\u2010-\u2015]/g, '-');
  const header = () => { doc.setFillColor(49, 9, 132); doc.rect(0, 0, width, 18, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('APP GESTIÓN LIMPATEX', margin, 11); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text('Análisis financiero · sin IVA · provisional', width - margin, 11, { align: 'right' }); doc.setTextColor(30, 41, 59); };
  header();
  const space = (needed: number) => { if (y + needed > height - 16) { doc.addPage(); header(); y = 28; } };
  const paragraph = (text: string, size = 9) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(size); const lines = doc.splitTextToSize(clean(text), contentWidth); for (const line of lines) { space(5); doc.text(line, margin, y); y += 5; } y += 2; };
  const heading = (title: string) => { space(16); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(49, 9, 132); doc.text(clean(title), margin, y); doc.setTextColor(30, 41, 59); y += 9; };
  heading(`Informe ${input.filters.start.slice(0, 7) === input.filters.end.slice(0, 7) ? 'mensual' : 'del periodo'} · ${input.sedeName}`);
  paragraph(`${input.filters.start.split('-').reverse().join('/')} - ${input.filters.end.split('-').reverse().join('/')} · ${input.draft ? 'Incluye configuración sin guardar' : 'Configuración guardada'} · Reparto: ${{ none: 'sin repartir', revenue: 'por ingresos', services: 'por servicios' }[input.allocation]}`);
  const tables = financialReportTables(input);
  const metadata = tables[0].rows.filter(row => ['Clientes', 'Propiedades', 'Edificios', 'Trabajadores', 'Tipos', 'Categorías de gasto'].includes(String(row[0])));
  paragraph(metadata.map(row => `${row[0]}: ${row[1]}`).join(' · '), 8);
  paragraph(input.filters.categories?.length ? 'VISTA PARCIAL: resultado y margen descuentan solo las categorías seleccionadas.' : 'Resultado provisional: tarifas actuales, ingresos por fecha del servicio y costes incluidos. No representa facturas ni cobros.', 8);
  paragraph(`${input.result.total.services} servicios · ${input.result.incomes.length} ingresos externos · ${input.result.total.pending} registros con datos pendientes · ${input.result.total.estimated} estimados`, 8);
  space(26);
  const cardWidth = (contentWidth - 9) / 4;
  ['Ingresos', 'Gastos', 'Resultado', 'Margen'].forEach((label, index) => {
    const x = margin + index * (cardWidth + 3); doc.setFillColor(245, 243, 255); doc.roundedRect(x, y, cardWidth, 22, 2, 2, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(label, x + 4, y + 7); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(clean(index === 3 ? percent(input.result.total.margin) : money([input.result.total.revenue, input.result.total.expense, input.result.total.result][index])), x + 4, y + 16);
  }); y += 30;
  space(80); heading('Ingresos y gastos desglosados');
  const costs = input.result.total.costs, series = [{ label: 'Ingresos', value: input.result.total.revenue, color: [109, 40, 217] }, { label: 'Personal y dirección', value: costs.personal + costs.salary, color: [37, 99, 235] }, { label: 'Lavandería', value: costs.laundry, color: [219, 39, 119] }, { label: 'Amenities y consumibles', value: costs.supplies, color: [217, 119, 6] }, { label: 'Productos', value: costs.products, color: [15, 118, 110] }, ...(costs.other ? [{ label: 'Otros', value: costs.other, color: [100, 116, 139] }] : [])];
  const maximum = Math.max(1, ...series.map(row => row.value)), groupWidth = contentWidth / series.length;
  doc.setDrawColor(203, 213, 225); doc.line(margin, y + 40, width - margin, y + 40);
  series.forEach((row, index) => { const x = margin + index * groupWidth + groupWidth * .23, barWidth = groupWidth * .54, barHeight = row.value / maximum * 34; doc.setFillColor(row.color[0], row.color[1], row.color[2]); if (barHeight) doc.roundedRect(x, y + 40 - barHeight, barWidth, barHeight, 1, 1, 'F'); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59); doc.text(clean(money(row.value)), x + barWidth / 2, y + 37 - barHeight, { align: 'center' }); doc.text(doc.splitTextToSize(row.label, groupWidth - 4), x + barWidth / 2, y + 46, { align: 'center' }); }); y += 64;
  const table = (title: string, rows: ReportCell[][]) => {
    space(35); heading(title);
    const widths = [89, 45, 45, 45, 45], labels = ['Concepto', 'Ingresos EUR', 'Gastos EUR', 'Resultado EUR', 'Margen %'];
    const tableHeader = () => { space(10); doc.setFillColor(237, 233, 254); doc.rect(margin, y - 4, contentWidth, 9, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); let x = margin; labels.forEach((label, index) => { doc.text(label, x + 2, y + 1); x += widths[index]; }); y += 10; };
    tableHeader();
    for (const row of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const labelLines = doc.splitTextToSize(clean(financialName(String(row[0]))), widths[0] - 4), rowHeight = Math.max(9, labelLines.length * 4.5 + 4);
      if (y + rowHeight > height - 16) { doc.addPage(); header(); y = 28; tableHeader(); }
      doc.setTextColor(30, 41, 59); doc.text(labelLines, margin + 2, y + 1); let x = margin + widths[0];
      row.slice(1).forEach((value, index) => { const text = value === null ? '-' : index === 3 ? percent(Number(value)) : money(Number(value) * 100); if (index === 2) doc.setTextColor(Number(value) < 0 ? '#be123c' : '#047857'); else doc.setTextColor(30, 41, 59); doc.text(clean(text), x + widths[index + 1] - 2, y + 1, { align: 'right' }); x += widths[index + 1]; });
      doc.setDrawColor(237, 233, 254); doc.line(margin, y + rowHeight - 4, width - margin, y + rowHeight - 4); y += rowHeight;
    }
    if (!rows.length) paragraph('Sin registros para estos filtros.'); y += 6;
  };
  for (const id of ['clients', 'properties', 'months']) { const sheet = tables.find(table => table.id === id)!; table(sheet.name, sheet.rows.map(row => [row[0], row[1], row[7], row[8], row[9]])); }
  heading('Notas del análisis'); paragraph('Los servicios sin ingreso permanecen fuera del balance y no generan costes automáticos. Los costes pendientes deben revisarse antes de interpretar la rentabilidad como definitiva. La evolución mensual conserva los filtros; su periodo propio puede superar las fechas del informe.', 8);
  paragraph('El coste de personal incluye dirección y estructura. El reparto es mensual y se calcula sobre toda la sede antes de filtrar. El Excel incluye servicios, ingresos externos, gastos adicionales y los registros fuera del balance.', 8);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139); doc.text(`${input.filters.start} - ${input.filters.end} · Sin IVA · Provisional`, margin, height - 7); doc.text(`${page} / ${pages}`, width - margin, height - 7, { align: 'right' }); }
  return doc;
}
