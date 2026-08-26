import assert from 'node:assert/strict';
import { buildStorageAccessSummary, getStorageAccessLabel } from '@/features/stock/propertyStorageAccess';

export function run() {
  const accessRows = [
    { propertyId: 'p1', propertyGroupId: 'b1', warehouseId: 'w1', accessType: 'shared', isActive: true },
    { propertyId: 'p2', propertyGroupId: 'b1', warehouseId: 'w1', accessType: 'shared', isActive: true },
    { propertyId: 'p3', propertyGroupId: 'b1', warehouseId: null, accessType: 'none', isActive: true },
  ] as const;

  const summary = buildStorageAccessSummary(
    [
      { id: 'p1', code: 'A1', name: 'Apartamento 1' },
      { id: 'p2', code: 'A2', name: 'Apartamento 2' },
      { id: 'p3', code: 'A3', name: 'Apartamento 3' },
      { id: 'p4', code: 'A4', name: 'Apartamento 4' },
    ],
    accessRows,
    'b1',
  );

  assert.equal(summary.physicalWarehouseIds.length, 1);
  assert.deepEqual(summary.physicalWarehouseIds, ['w1']);
  assert.deepEqual(summary.byWarehouseId.w1.propertyIds, ['p1', 'p2']);
  assert.deepEqual(summary.withoutAccessPropertyIds, ['p3']);
  assert.deepEqual(summary.unconfiguredPropertyIds, ['p4']);
  assert.equal(getStorageAccessLabel('shared'), 'Comparte el trastero del edificio');
  assert.equal(getStorageAccessLabel('none'), 'Sin acceso a trastero');
}
