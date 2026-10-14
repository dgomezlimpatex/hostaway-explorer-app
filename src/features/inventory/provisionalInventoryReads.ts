import { supabase } from '@/integrations/supabase/client';
import { readAll, type ReadQuery } from './inventoryReadiness';
import type { ProvisionalReads } from './provisionalInventory';

const db = supabase as unknown as { from(table: string): ReadQuery };
export async function readProvisionalInventory(sedeId: string, warehouseId: string, earliest: string): Promise<ProvisionalReads> {
  // Keep preparation history before the period to recognise bags that were simply marked again.
  const [movements, preparations, mappings, estimates, levels] = await Promise.all([
    readAll(() => db.from('stock_movements').select('id,product_id,warehouse_id,movement_type,previous_quantity,new_quantity,created_at,reason')
      .eq('warehouse_id', warehouseId).gte('created_at', `${earliest}T00:00:00Z`).order('id')),
    readAll(() => db.from('laundry_bag_action_ledger').select('id,task_key,action,bag_items,happened_at').eq('sede_id', sedeId).order('id')),
    readAll(() => db.from('stock_property_field_mappings').select('id,property_field,product_id,warehouse_id,multiplier,is_active').eq('sede_id', sedeId).order('id')),
    readAll(() => db.from('stock_estimated_amenity_entries').select('id,product_id,warehouse_id,quantity,scheduled_end_at,state')
      .eq('sede_id', sedeId).eq('warehouse_id', warehouseId).eq('state', 'applied').order('id')),
    readAll(() => db.from('stock_levels').select('id,product_id,warehouse_id,current_quantity').eq('warehouse_id', warehouseId).order('id')),
  ]);
  return { movements, preparations, mappings, estimates, levels };
}
