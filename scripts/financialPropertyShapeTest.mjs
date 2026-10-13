import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'financial-property-shape-'));
try {
  await build({ entryPoints: ['src/features/financial/financialSource.ts'], outfile: join(dir, 'source.mjs'),
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { normalizeFinancialProperties, buildServices } = await import(pathToFileURL(join(dir, 'source.mjs')));
  const group = { id: 'g', name: 'Edificio', display_name: 'Edificio visible', is_active: false };
  const assignment = { property_group_id: 'g', group };
  const property = { id: 'p', nombre: 'Propiedad', cliente_id: 'c', coste_servicio: 100, duracion_servicio: 60,
    numero_sabanas: 2, amenities_control_enabled: false };
  const task = { id: 't', type: 'limpieza-turistica', date: '2026-10-13', status: 'pending', propiedad_id: 'p',
    cliente_id: 'c', cleaner_id: 'w', cleaner: 'Persona', start_time: '10:00', end_time: '11:00', task_assignments: [] };

  const rawObject = { ...property, property_group_assignments: assignment };
  const rawArray = { ...property, property_group_assignments: [assignment] };
  // Reproduce the former crash at the model boundary as well as the reader loop.
  assert.throws(() => buildServices([task], [rawObject], []), /map is not a function/);
  assert.throws(() => [...rawObject.property_group_assignments], /not iterable/);
  const object = normalizeFinancialProperties([rawObject]);
  const array = normalizeFinancialProperties([rawArray]);
  assert.deepEqual(object, array);
  assert.equal(rawObject.property_group_assignments, assignment, 'Do not mutate the response');
  assert.deepEqual(normalizeFinancialProperties(object), object, 'Normalization is idempotent');
  assert.deepEqual(buildServices([task], object, []), buildServices([task], array, []));
  const service = buildServices([task], object, [])[0];
  assert.deepEqual(service.buildingIds, ['g']);
  assert.equal(service.revenue, 10000);
  assert.equal(service.quantities.doubleSheet, 2);
  assert.equal(service.workers[0].minutes, 60);
  assert.equal(object[0].property_group_assignments[0].group.is_active, false, 'Retired building history remains available');
  for (const relation of [null, undefined, []]) {
    const rows = normalizeFinancialProperties([{ ...property, property_group_assignments: relation }]);
    assert.deepEqual(rows[0].property_group_assignments, []);
    assert.deepEqual(buildServices([task], rows, [])[0].buildingIds, []);
  }
  for (const nested of [null, [], [group], group]) {
    const rows = normalizeFinancialProperties([{ ...property, property_group_assignments: { ...assignment, group: nested } }]);
    assert.deepEqual(buildServices([task], rows, [])[0].buildingIds, ['g']);
  }
  console.log('Financial property shape: reproduced legacy crash; object/array/null, history, unchanged amounts and non-mutating normalization OK');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
