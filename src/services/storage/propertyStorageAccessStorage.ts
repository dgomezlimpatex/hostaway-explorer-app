import { supabase } from '@/integrations/supabase/client';
import type { PropertyStorageAccessRow, PropertyStorageAccessType } from '@/features/stock/propertyStorageAccess';

// The migration is newer than the generated Supabase types; keep the boundary typed locally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type PropertyStorageAccessDbRow = {
  id: string;
  property_id: string;
  property_group_id: string;
  warehouse_id: string | null;
  access_type: PropertyStorageAccessType;
  notes: string | null;
  is_active: boolean;
};

const mapRow = (row: PropertyStorageAccessDbRow): PropertyStorageAccessRow => ({
  id: row.id,
  propertyId: row.property_id,
  propertyGroupId: row.property_group_id,
  warehouseId: row.warehouse_id,
  accessType: row.access_type,
  notes: row.notes,
  isActive: row.is_active,
});

export const propertyStorageAccessStorage = {
  async getByBuilding(propertyGroupId: string): Promise<PropertyStorageAccessRow[]> {
    const { data, error } = await db
      .from('property_storage_access')
      .select('id,property_id,property_group_id,warehouse_id,access_type,notes,is_active')
      .eq('property_group_id', propertyGroupId)
      .eq('is_active', true)
      .order('property_id');
    if (error) throw error;
    return ((data || []) as PropertyStorageAccessDbRow[]).map(mapRow);
  },

  async setAccess(input: {
    propertyId: string;
    propertyGroupId: string;
    accessType: PropertyStorageAccessType;
    warehouseId?: string | null;
    notes?: string | null;
  }): Promise<PropertyStorageAccessRow> {
    const { data, error } = await db.rpc('set_property_storage_access', {
      _property_id: input.propertyId,
      _property_group_id: input.propertyGroupId,
      _access_type: input.accessType,
      _warehouse_id: input.accessType === 'shared' ? input.warehouseId || null : null,
      _notes: input.notes || null,
    });
    if (error) throw error;
    return mapRow(data as PropertyStorageAccessDbRow);
  },
};
