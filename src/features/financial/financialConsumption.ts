import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages, type ConsumptionRule } from './financialSource';

// Keep each request small and avoid expanding the RLS plans of properties,
// rules and products together. The property directory is already scoped by sede.
const ID_BATCH_SIZE = 20;

export async function readFinancialConsumption(client: SupabaseClient, propertyIds: string[]): Promise<ConsumptionRule[]> {
  const ids = [...new Set(propertyIds)];
  const rules: { property_id: string; product_id: string; quantity_per_cleaning: number }[] = [];
  for (let offset = 0; offset < ids.length; offset += ID_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + ID_BATCH_SIZE);
    rules.push(...await readAllPages((from, to) => client.from('stock_property_consumption_rules')
      .select('property_id,product_id,quantity_per_cleaning')
      .in('property_id', batch).eq('is_active', true).order('updated_at').order('id').range(from, to)));
  }

  const productIds = [...new Set(rules.map(rule => rule.product_id))];
  const products = new Map<string, { name: string }>();
  for (let offset = 0; offset < productIds.length; offset += ID_BATCH_SIZE) {
    const batch = productIds.slice(offset, offset + ID_BATCH_SIZE);
    const rows = await readAllPages((from, to) => client.from('stock_products')
      .select('id,name').in('id', batch).order('id').range(from, to));
    for (const product of rows) products.set(product.id, { name: product.name });
  }
  // Missing/inaccessible products retain the old left-join behaviour. A failed
  // request throws instead of returning partial costs as a successful balance.
  return rules.map(rule => ({ property_id: rule.property_id, quantity_per_cleaning: rule.quantity_per_cleaning,
    product: products.get(rule.product_id) ?? null }));
}
