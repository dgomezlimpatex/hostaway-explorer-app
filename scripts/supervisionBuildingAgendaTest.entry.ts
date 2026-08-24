import { buildBuildingSupervisionAgenda } from '@/features/supervision/buildingAgenda';

export function run(assert: typeof import('node:assert/strict')) {
  const agenda = buildBuildingSupervisionAgenda({
    date: '2026-08-24',
    buildings: [
      { id: 'b1', name: 'Marina 30' },
      { id: 'b2', name: 'Turquoise' },
    ],
    properties: [
      { id: 'p2', code: 'M2', name: 'Apartamento 2', buildingId: 'b1' },
      { id: 'p1', code: 'M1', name: 'Apartamento 1', buildingId: 'b1' },
      { id: 'p3', code: 'T1', name: 'Apartamento T1', buildingId: 'b2' },
    ],
    tasks: [
      { id: 't1', propertyId: 'p1', date: '2026-08-24', status: 'completed', checkIn: '2026-08-24T16:00:00' },
      { id: 't2', propertyId: 'p2', date: '2026-08-24', status: 'completed' },
      { id: 't3', propertyId: 'p3', date: '2026-08-24', status: 'pending' },
    ],
    reviews: [
      { id: 'r1', propertyId: 'p2', state: 'reviewed', review_type: 'quick', created_at: '2026-08-24T10:00:00Z' },
    ],
    incidents: [
      { id: 'i1', propertyId: 'p1', status: 'open', priority: 'critical', created_at: '2026-08-24T11:00:00Z' },
    ],
  });

  assert.deepEqual(agenda.buildings[0].properties.map((property) => property.code), ['M1', 'M2']);
  assert.equal(agenda.buildings[0].items.length, 2);
  assert.equal(agenda.buildings[0].items[0].type, 'incident');
  assert.equal(agenda.buildings[0].items[0].priority, 100);
  assert.equal(agenda.buildings[0].items[1].status, 'completed');
  assert.equal(agenda.buildings[1].items.length, 0);
  assert.equal(agenda.pendingCount, 1);
  assert.equal(agenda.completedCount, 1);

  const reworkAgenda = buildBuildingSupervisionAgenda({
    date: '2026-08-24',
    buildings: [{ id: 'b1', name: 'Marina 30' }],
    properties: [{ id: 'p1', name: 'Apartamento 1', buildingId: 'b1' }],
    tasks: [{ id: 't1', propertyId: 'p1', date: '2026-08-24', status: 'completed' }],
    reviews: [{ id: 'r1', propertyId: 'p1', state: 'returned_for_rework', created_at: '2026-08-23T10:00:00Z' }],
    incidents: [],
  });
  assert.equal(reworkAgenda.buildings[0].items[0].type, 'rework');
}
