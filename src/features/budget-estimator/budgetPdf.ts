import { jsPDF } from 'jspdf';

export interface CommercialBudgetPdfItem {
  name: string;
  address?: string;
  durationMinutes: number;
  salePrice: number;
  monthlySalePrice: number;
  extras?: Array<{ name: string; salePrice: number }>;
}

export interface CommercialBudgetPdfData {
  quoteNumber: string;
  title: string;
  clientName: string;
  validityDate?: string;
  terms?: string;
  monthlyRotations: number;
  items: CommercialBudgetPdfItem[];
  totals: {
    totalRevenue: number;
    monthlyRevenue: number;
  };
}

const PURPLE = '#310984';
const LIGHT_PURPLE = '#eee9ff';
const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const money = (value: number) => currency.format(value);

const writeWrapped = (doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5) => {
  const lines = doc.splitTextToSize(text || '', width) as string[];
  doc.text(lines, x, y);
  return y + Math.max(lines.length, 1) * lineHeight;
};

const ensureSpace = (doc: jsPDF, y: number, required: number) => {
  if (y + required <= 275) return y;
  doc.addPage();
  return 20;
};

export const getCommercialPdfFileName = (quoteNumber: string) => `${quoteNumber.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`;

export function generateCommercialBudgetPdf(data: CommercialBudgetPdfData): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 22;

  doc.setFillColor(PURPLE);
  doc.rect(0, 0, pageWidth, 13, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('LIMPATEX', 18, 9);
  doc.setFontSize(9);
  doc.text('PRESUPUESTO DE SERVICIOS TURÍSTICOS', pageWidth - 18, 8.5, { align: 'right' });

  doc.setTextColor(PURPLE);
  doc.setFontSize(22);
  doc.text('Presupuesto', 18, y);
  y += 8;
  doc.setTextColor('#374151');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Referencia: ${data.quoteNumber}`, 18, y);
  doc.text(`Fecha: ${new Intl.DateTimeFormat('es-ES').format(new Date())}`, pageWidth - 18, y, { align: 'right' });
  y += 8;

  doc.setFillColor(LIGHT_PURPLE);
  doc.roundedRect(18, y, pageWidth - 36, 25, 3, 3, 'F');
  doc.setTextColor(PURPLE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(data.title, 24, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#374151');
  doc.setFontSize(9);
  doc.text(`Cliente: ${data.clientName || 'A la atención del cliente'}`, 24, y + 15);
  if (data.validityDate) doc.text(`Válido hasta: ${data.validityDate}`, 24, y + 21);
  y += 36;

  doc.setTextColor(PURPLE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Servicios incluidos', 18, y);
  y += 7;

  data.items.forEach((item) => {
    y = ensureSpace(doc, y, 40);
    doc.setDrawColor('#d9d3ed');
    doc.roundedRect(18, y, pageWidth - 36, 30, 3, 3, 'S');
    doc.setTextColor('#111827');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(item.name, 24, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor('#4b5563');
    if (item.address) doc.text(item.address, 24, y + 14);
    doc.text(`Limpieza de ${item.durationMinutes} minutos`, 24, y + 21);
    doc.setTextColor(PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.text(`${money(item.salePrice)} / servicio`, pageWidth - 24, y + 10, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`${money(item.monthlySalePrice)} / mes estimado`, pageWidth - 24, y + 17, { align: 'right' });
    if (item.extras?.length) {
      const extras = item.extras.map((extra) => `${extra.name}: ${money(extra.salePrice)}`).join(' · ');
      doc.setFontSize(8);
      doc.setTextColor('#6b7280');
      doc.text(extras, 24, y + 26);
    }
    y += 37;
  });

  y = ensureSpace(doc, y, 55);
  doc.setFillColor(PURPLE);
  doc.roundedRect(18, y, pageWidth - 36, 38, 3, 3, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Rotaciones mensuales estimadas: ${data.monthlyRotations}`, 25, y + 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Total por servicio', 25, y + 22);
  doc.text(money(data.totals.totalRevenue), pageWidth - 25, y + 22, { align: 'right' });
  doc.setFontSize(10);
  doc.text('Total mensual estimado', 25, y + 31);
  doc.text(money(data.totals.monthlyRevenue), pageWidth - 25, y + 31, { align: 'right' });
  y += 50;

  if (data.terms) {
    y = ensureSpace(doc, y, 30);
    doc.setTextColor(PURPLE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Condiciones', 18, y);
    y += 6;
    doc.setTextColor('#4b5563');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y = writeWrapped(doc, data.terms, 18, y, pageWidth - 36, 5);
  }

  doc.setTextColor('#6b7280');
  doc.setFontSize(8);
  doc.text('Documento comercial generado por Limpatex Servicios Integrales SL.', 18, 287);
  doc.text(data.quoteNumber, pageWidth - 18, 287, { align: 'right' });

  return doc.output('blob');
}

export function downloadCommercialBudgetPdf(data: CommercialBudgetPdfData) {
  const blob = generateCommercialBudgetPdf(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getCommercialPdfFileName(data.quoteNumber);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return blob;
}
