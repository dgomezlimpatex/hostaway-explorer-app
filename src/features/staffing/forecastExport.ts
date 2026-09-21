/** Protect spreadsheet consumers from formulas supplied in names. */
export function forecastCsv(rows: (string | number)[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    const raw = typeof value === 'number' ? new Intl.NumberFormat('es-ES', { useGrouping: false, maximumFractionDigits: 3 }).format(value) : value;
    const safe = /^[=+@\-\t\r]/.test(raw.trimStart()) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(';')).join('\r\n');
}
export function downloadForecastCsv(rows: (string | number)[][], month: string) {
  const url = URL.createObjectURL(new Blob([forecastCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `prevision-${month}.csv`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
