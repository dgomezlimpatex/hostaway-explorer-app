export const TRASH_SACK_START = '2026-10-09';
export const TRASH_SACK_SKU = 'SACOS-BASURA-100L';
export const isTrashSack = (product: { name?: unknown; sku?: unknown }) =>
  product.sku === TRASH_SACK_SKU || /^sacos? (?:de )?basura 100\s*l$/i.test(String(product.name ?? '').trim());

// The service date (Madrid calendar date), not the preparation date, governs use.
export function trashSackQuantity(property: Record<string, unknown> | null | undefined, date: string): number {
  if (date < TRASH_SACK_START) return 0;
  const rules = property?.stock_property_consumption_rules;
  if (!Array.isArray(rules)) return 0;
  return rules.reduce((total, rule) => {
    const product = rule.stock_products;
    const quantity = Number(rule.quantity_per_cleaning);
    return rule.is_active && product?.is_active && product?.is_consumable &&
      product.sede_id === property?.sede_id && isTrashSack(product) && Number.isSafeInteger(quantity) && quantity >= 0
      ? total + quantity : total;
  }, 0);
}
