import { generateCommercialBudgetPdf, getCommercialPdfFileName } from '../src/features/budget-estimator/budgetPdf';

export async function run(assert: typeof import('node:assert/strict')) {
  const blob = generateCommercialBudgetPdf({
    quoteNumber: 'PRES-20260810-00001',
    title: 'Limpieza turística de apartamento',
    clientName: 'Cliente de prueba',
    validityDate: '2026-09-10',
    terms: 'Validez 30 días.',
    monthlyRotations: 4,
    items: [{
      name: 'Apartamento Centro',
      address: 'Calle de prueba 1',
      durationMinutes: 120,
      salePrice: 39,
      monthlySalePrice: 156,
      extras: [{ name: 'Lavandería', salePrice: 8 }],
    }],
    totals: {
      totalRevenue: 47,
      monthlyRevenue: 188,
    },
  });

  assert.ok(blob.size > 500);
  assert.equal(blob.type, 'application/pdf');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 5)), '%PDF-');
  assert.match(getCommercialPdfFileName('PRES-20260810-00001'), /PRES-20260810-00001\.pdf$/);
}
