/** Protect spreadsheet consumers from formulas supplied in names. */
export function forecastCsv(rows: (string | number)[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    const raw = typeof value === 'number' ? Number.isFinite(value) ? new Intl.NumberFormat('es-ES', { useGrouping: false, maximumFractionDigits: 3 }).format(value) : 'Por verificar' : value;
    const safe = /^[=+@\-\t\r]/.test(raw.trimStart()) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(';')).join('\r\n');
}
export function downloadForecastCsv(rows: (string | number)[][], month: string, type = 'prevision') {
  const url = URL.createObjectURL(new Blob([forecastCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type}-${month}.csv`;
  document.body.append(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
