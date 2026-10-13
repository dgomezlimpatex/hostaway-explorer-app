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
// Whole euros for dense labels (month strip): "7.209 €".
const currencyWhole = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: false, maximumFractionDigits: 0 });
export const moneyWhole = (cents: number): string => groupedParts(currencyWhole.formatToParts(Math.round(cents / 100)));
// Compact thousands for narrow screens: 850 · 7,2k · 124k.
export function compactMoney(cents: number): string {
  const euros = Math.abs(cents) / 100, sign = cents < 0 ? '-' : '';
  if (euros < 1000) return sign + decimal(Math.round(euros), 0);
  return sign + decimal(euros / 1000, euros < 100000 ? 1 : 0) + 'k';
}
