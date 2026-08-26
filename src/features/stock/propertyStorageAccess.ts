export type PropertyStorageAccessType = 'shared' | 'none';

export interface PropertyStorageAccessRow {
  id?: string;
  propertyId: string;
  propertyGroupId: string;
  warehouseId: string | null;
  accessType: PropertyStorageAccessType;
  notes?: string | null;
  isActive: boolean;
}

export interface StorageAccessProperty {
  id: string;
  code: string;
  name: string;
}

export interface StorageAccessWarehouseGroup {
  warehouseId: string;
  propertyIds: string[];
}

export interface StorageAccessSummary {
  physicalWarehouseIds: string[];
  byWarehouseId: Record<string, StorageAccessWarehouseGroup>;
  withoutAccessPropertyIds: string[];
  unconfiguredPropertyIds: string[];
}

export const getStorageAccessLabel = (accessType: PropertyStorageAccessType): string => (
  accessType === 'shared' ? 'Comparte el trastero del edificio' : 'Sin acceso a trastero'
);

export function buildStorageAccessSummary(
  properties: StorageAccessProperty[],
  accessRows: readonly PropertyStorageAccessRow[],
  propertyGroupId: string,
): StorageAccessSummary {
  const propertyIds = new Set(properties.map((property) => property.id));
  const rowsByPropertyId = new Map(
    accessRows
      .filter((row) => row.propertyGroupId === propertyGroupId && row.isActive && propertyIds.has(row.propertyId))
      .map((row) => [row.propertyId, row]),
  );
  const byWarehouseId: Record<string, StorageAccessWarehouseGroup> = {};
  const withoutAccessPropertyIds: string[] = [];
  const unconfiguredPropertyIds: string[] = [];

  for (const property of properties) {
    const row = rowsByPropertyId.get(property.id);
    if (!row) {
      unconfiguredPropertyIds.push(property.id);
      continue;
    }
    if (row.accessType === 'none' || !row.warehouseId) {
      withoutAccessPropertyIds.push(property.id);
      continue;
    }
    const group = byWarehouseId[row.warehouseId] || { warehouseId: row.warehouseId, propertyIds: [] };
    group.propertyIds.push(property.id);
    byWarehouseId[row.warehouseId] = group;
  }

  return {
    physicalWarehouseIds: Object.keys(byWarehouseId).sort(),
    byWarehouseId,
    withoutAccessPropertyIds,
    unconfiguredPropertyIds,
  };
}
