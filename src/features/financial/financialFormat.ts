const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: false });
const groupedParts = (parts: Intl.NumberFormatPart[]) => parts.map(part => part.type === 'integer' ? part.value.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : part.value).join('');
// Explicit grouping also covers four-digit amounts, which es-ES leaves ungrouped by default.
export function money(cents: number): string {
  return groupedParts(currency.formatToParts(cents / 100));
}
export function decimal(value: number, digits = 1, maximumDigits = digits): string {
  return groupedParts(new Intl.NumberFormat('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: maximumDigits, useGrouping: false }).formatToParts(value));
}
export const percent = (value: number | null, digits = 1) => value === null ? '—' : `${decimal(value, digits)}%`;
// Display only. Keep original names/IDs in settings, filters and detail links.
export function financialName(value: string): string {
  return value.replace(/\bS\.?\s*L\.?$/i, 'SL').replace(/\bHotel SC\b/g, 'Hotel Santa Catalina').replace(/\bLimp\.\s*de\b/gi, 'Limpieza de');
}
