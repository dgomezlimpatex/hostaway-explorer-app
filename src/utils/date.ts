// Date helpers

/**
 * Format a Date into YYYY-MM-DD in Europe/Madrid timezone.
 * This avoids off-by-one-day issues caused by Date#toISOString() (UTC).
 */
export const formatMadridDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    // Fallback (should be extremely rare)
    return date.toISOString().split('T')[0];
  }

  return `${year}-${month}-${day}`;
};
