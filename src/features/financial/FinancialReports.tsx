import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FinancialReportInput } from './financialReporting';

const tables = [['clients', 'Clientes'], ['properties', 'Propiedades'], ['services', 'Servicios'], ['incomes', 'Ingresos externos'], ['expenses', 'Gastos adicionales'], ['months', 'Evolución mensual'], ['excluded', 'Fuera del balance'], ['summary', 'Resumen y filtros']] as const;
export function FinancialReports({ input, disabled }: { input: FinancialReportInput; disabled: boolean }) {
  const [table, setTable] = useState('clients'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const exportFile = async (format: 'csv' | 'excel' | 'pdf') => {
    if (disabled || busy) return;
    setBusy(true); setError('');
    try {
      const stem = `analisis-financiero-${input.filters.start}-${input.filters.end}${input.filters.categories?.length ? '-parcial' : ''}`;
      const reports = await import('./financialReporting');
      const sheets = reports.financialReportTables(input);
      let blob: Blob, filename: string;
      if (format === 'csv') { blob = new Blob([reports.financialCsv(sheets.find(sheet => sheet.id === table)!, table === 'summary' ? undefined : sheets[0])], { type: 'text/csv;charset=utf-8' }); filename = `${stem}-${table}.csv`; }
      else if (format === 'excel') { blob = new Blob([await reports.financialExcel(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); filename = `${stem}.xlsx`; }
      else { const { financialPdf } = await import('./financialPdf'); blob = financialPdf(input).output('blob'); filename = `${stem}.pdf`; }
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo generar el informe.'); }
    finally { setBusy(false); }
  };
  return <details className="relative min-w-0 rounded-md border bg-white text-sm"><summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 font-medium text-[#310984]"><Download className="h-4 w-4" />Informes y exportación</summary><div className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-violet-100 bg-white p-4 shadow-xl"><label className="block text-sm">Tabla para CSV<select className="mt-1 h-10 w-full rounded-md border px-2" value={table} onChange={event => setTable(event.target.value)}>{tables.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => exportFile('csv')}>CSV</Button><Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => exportFile('excel')}>Excel completo</Button><Button size="sm" disabled={disabled || busy} onClick={() => exportFile('pdf')}>Informe PDF</Button></div><p className="text-xs leading-relaxed text-slate-500">Descarga con los filtros y el reparto actuales. Excel incluye todas las tablas; PDF incluye resumen, gráficos, clientes, propiedades y evolución. Importes sin IVA y provisionales{input.draft ? ' · configuración sin guardar' : ''}.</p>{busy && <p role="status" className="text-xs">Generando informe…</p>}{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}</div></details>;
}
