type Content = Record<string, unknown>;

const quantities = (value: unknown) => Object.entries(
  value && typeof value === 'object' ? value as Content : {},
).map(([key, quantity]) => [key, Number(quantity) || 0] as const)
  .filter(([, quantity]) => quantity !== 0)
  .sort(([a], [b]) => a.localeCompare(b));

// Operational metadata (cleaner, cleaning status, times) never changes a bag.
export function bagRequirementsSignature(content: Content): string {
  return JSON.stringify({
    propertyId: content.propertyId ?? '',
    textiles: quantities(content.textiles),
    amenities: quantities(content.amenities),
  });
}

export function bagRequirementsChanged(previous: Content | null, current: Content): boolean {
  if (!previous) return false;
  if (bagRequirementsSignature(previous) !== bagRequirementsSignature(current)) return true;
  // Older snapshots did not store stock rules. Establish their baseline without
  // asking workers to prepare all previously completed bags again on rollout.
  if (!Array.isArray(previous.stockConsumables)) return false;
  const stock = (content: Content) => (Array.isArray(content.stockConsumables) ? content.stockConsumables : [])
    .map((item: Content) => [String(item.productId), Number(item.quantity) || 0])
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  return JSON.stringify(stock(previous)) !== JSON.stringify(stock(current));
}
