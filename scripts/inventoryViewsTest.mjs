// Node checks of the inventory view rules used by the redesigned pages. Real module, no backend or network.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const built = await build({ stdin: { contents: `export * from './src/features/inventory/inventoryViews'; export { pendingDemand, buildingInventory } from './src/features/inventory/inventoryDomain';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node', metafile: true });
assert.ok(!Object.keys(built.metafile.inputs).some(p => p.includes('integrations/supabase')), 'view rules never reach the backend');
const m = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);

const product = (id, name, kind = 'laundry', consumable = true) => ({ id, name, is_active: true, is_consumable: consumable, category: { kind } });
const sheet = product('sheet', 'Sábanas 150'), soap = product('soap', 'Amenities baño', 'amenity'), quilt = product('quilt', 'Edredones', 'laundry', false);
const level = (over = {}) => ({ id: 'l', warehouse_id: 'central', product_id: 'sheet', product: sheet, current_quantity: 10, minimum_quantity: 0, target_quantity: 0, ...over });

// Tones split "unknown" without changing levelState: undefined reserve is not a discrepancy, and neither is urgent.
assert.equal(m.levelTone(level()).tone, 'undefined');
assert.equal(m.levelTone(level({ current_quantity: 0 })).tone, 'undefined', 'zero without reserve is not a shortage');
assert.equal(m.levelTone(level({ current_quantity: -2 })).tone, 'check', 'negative balance stays visible');
assert.equal(m.levelTone(level({ quantity_basis: 'partial' })).tone, 'partial');
assert.equal(m.levelTone(level({ quantity_basis: 'partial' }), 4).tone, 'covered');
assert.deepEqual([m.levelTone(level(), 13).tone, m.levelTone(level(), 13).missing], ['shortage', 3]);
assert.equal(m.levelTone(level({ reserved_quantity: 6 }), 5).tone, 'shortage', 'reserved bag stock is not available twice');
assert.equal(m.levelTone(level({ target_quantity: 12 }), 2).tone, 'replenish');
assert.equal(m.levelTone(level({ target_quantity: 5 }), 2).tone, 'covered');

// Status filters.
assert.equal(m.matchesStockStatus(level({ target_quantity: 20 }), 'attention'), true);
assert.equal(m.matchesStockStatus(level(), 'attention'), false);
assert.equal(m.matchesStockStatus(level({ current_quantity: -1 }), 'check'), true);
assert.equal(m.matchesStockStatus(level(), 'check'), false);
assert.equal(m.matchesStockStatus(level(), 'unknown'), true);
assert.equal(m.matchesStockStatus(level({ current_quantity: 6, reserved_quantity: 6 }), 'empty'), true);
assert.equal(m.matchesStockStatus(level({ current_quantity: 3, minimum_quantity: 4 }), 'low'), true);
assert.equal(m.matchesStockStatus(level(), ''), true);
assert.deepEqual(m.groupByFamily([level({ id: 'a', product: quilt }), level({ id: 'b', product: soap }), level({ id: 'c' })]).map(g => [g.label, g.levels[0].id]), [['Ropa', 'c'], ['Consumibles', 'b'], ['Repuestos', 'a']]);
assert.equal(m.locationName('TRASTERO - Orzán 12'), 'Orzán 12');

// Bags: counts, filters and search by building; delivery is never inferred from preparation.
const warehouses = [{ id: 'b0', name: 'TRASTERO - Orzán 12' }, { id: 'b1', name: 'TRASTERO - Riazor 4' }];
const bag = (taskId, state, warehouseId = 'b0', code = 'ORZ-' + taskId) => ({ taskId, propertyCode: code, date: '2026-10-15', warehouseId, state, issue: null, lines: [{ productId: 'sheet', name: 'Sábanas 150', quantity: 2 }] });
const bags = [bag('1', 'pending'), bag('2', 'prepared'), bag('3', 'delivered'), bag('4', 'issue', 'b1', 'RIA-4'), bag('5', 'review', null, 'ENS-5')];
assert.deepEqual(m.bagCounts(bags), { pending: 3, prepared: 1, delivered: 1, issue: 2, all: 5 });
assert.deepEqual(m.filterBags(bags, 'issue', '', warehouses).map(b => b.taskId), ['4', '5']);
assert.deepEqual(m.filterBags(bags, 'all', 'riazor', warehouses).map(b => b.taskId), ['4']);
assert.deepEqual(m.filterBags(bags, 'all', 'orzan', warehouses).map(b => b.taskId), ['1', '2', '3'], 'accent-insensitive building search');
assert.deepEqual(m.groupBagsByDestination(bags, warehouses).map(g => g.name), ['Orzán 12', 'Riazor 4', 'Destino por comprobar']);
assert.equal(m.bagContent({ lines: [{ name: 'Sábanas 150', quantity: 2 }, { name: 'Fundas', quantity: 1.5 }] }), '2 Sábanas 150 · 1,5 Fundas');
assert.equal(m.shortDay('2026-10-15'), 'jue 15/10');
assert.equal(m.shortDay('2026-03-29'), 'dom 29/03', 'business dates do not shift on the summer time change');

// Movements: signed change from the stored balances; transfers report the moved quantity.
assert.deepEqual(m.movementChange({ movement_type: 'entrada', quantity: 4, previous_quantity: 10, new_quantity: 14 }), { value: 4, text: '+4', sign: 1 });
assert.deepEqual(m.movementChange({ movement_type: 'ajuste', quantity: 7, previous_quantity: 10, new_quantity: 7 }), { value: -3, text: '-3', sign: -1 });
assert.equal(m.movementChange({ movement_type: 'transferencia', quantity: 5, previous_quantity: 10, new_quantity: 5 }).text, '5');
assert.equal(m.movementChange({ movement_type: 'salida', quantity: 1, previous_quantity: null, new_quantity: undefined }).text, '—', 'missing balances are not shown as zero');
const movements = [{ id: '1', movement_type: 'entrada', product_id: 'sheet', warehouse_id: 'central', to_warehouse_id: null, reason: 'Recepción', product: { name: 'Sábanas 150' }, warehouse: { name: 'Simón Bolívar' } },
  { id: '2', movement_type: 'transferencia', product_id: 'soap', warehouse_id: 'central', to_warehouse_id: 'b0', reason: 'Reposición', product: { name: 'Amenities baño' }, warehouse: { name: 'Simón Bolívar' }, to_warehouse: { name: 'TRASTERO - Orzán 12' } }];
assert.deepEqual(m.filterMovements(movements, { warehouseId: 'b0' }).map(x => x.id), ['2'], 'a destination location sees incoming transfers');
assert.deepEqual(m.filterMovements(movements, { productId: 'sheet' }).map(x => x.id), ['1']);
assert.deepEqual(m.filterMovements(movements, { search: 'orzan' }).map(x => x.id), ['2']);
assert.deepEqual(m.filterMovements(movements, { type: 'entrada', search: 'recepcion' }).map(x => x.id), ['1']);

// Adjustment preview mirrors entrada/salida/ajuste and flags impossible input.
assert.equal(m.adjustmentResult(18, 'entrada', 10), 28);
assert.equal(m.adjustmentResult(18, 'salida', 20), -2);
assert.equal(m.adjustmentResult(18, 'ajuste', 12.5), 12.5);
assert.equal(m.adjustmentResult(18, 'entrada', -1), null);
assert.equal(m.adjustmentResult(18, 'entrada', NaN), null);

// Summary actions: ordered by urgency, with causes, and nothing invented when bags are unknown.
const central = { id: 'central', name: 'Simón Bolívar', is_active: true, location_type: 'central' };
const store = { id: 'b0', name: 'TRASTERO - Orzán 12', is_active: true, location_type: 'building_storage' };
const centralLevels = [level({ id: 'l1', current_quantity: 18, reserved_quantity: 6 }), level({ id: 'l2', product_id: 'soap', product: soap, current_quantity: 22, minimum_quantity: 30, target_quantity: 60 }),
  level({ id: 'l3', product_id: 'x', product: product('x', 'Bayetas', 'amenity'), current_quantity: -3, minimum_quantity: 10, target_quantity: 20 }), level({ id: 'l4', product_id: 'k', product: product('k', 'Kit', 'amenity') })];
const allLevels = [...centralLevels, level({ id: 's', warehouse_id: 'b0', product_id: 'quilt', product: quilt, current_quantity: 0, minimum_quantity: 1, target_quantity: 2 })];
const demandBags = [{ ...bag('1', 'pending'), lines: [{ productId: 'sheet', name: 'Sábanas 150', quantity: 19 }] }, bag('2', 'prepared'), bag('4', 'issue', 'b1')];
const input = (demandReady) => ({ central, centralLevels, demand: demandReady ? m.pendingDemand(demandBags) : new Map(), demandReady, bags: demandReady ? demandBags : [],
  buildings: m.buildingInventory([central, store], allLevels, [], 'central'), missingProducts: demandReady ? [{ id: 'm', name: 'Alfombrines' }] : [], to: '2026-10-17' });
const actions = m.inventoryActions(input(true));
assert.deepEqual(actions.map(a => a.id), ['short-l1', 'missing', 'issues', 'pending', 'prepared', 'replenish', 'buildings', 'check', 'undefined']);
assert.equal(actions[0].title, 'Faltan 9 Sábanas 150 para las mudas');
assert.equal(actions[0].reason, 'Disponible en Simón Bolívar: 12 · Para mudas por preparar: 21');
assert.equal(actions[0].to, '/inventory/stock?product=sheet');
assert.equal(actions.find(a => a.id === 'undefined').tone, 'info', 'undefined reserve is never urgent');
assert.equal(actions.find(a => a.id === 'pending').title, '2 mudas por preparar');
assert.match(actions.find(a => a.id === 'buildings').reason, /Orzán 12/);
const offline = m.inventoryActions(input(false));
assert.deepEqual(offline.map(a => a.id), ['replenish', 'buildings', 'check', 'undefined'], 'unknown bags produce no shortage or bag counts');
console.log('PASS inventory views: tones, status filters, families, bag counts and search, Madrid business dates, signed movements, adjustment preview and ordered summary actions; real module, no network.');
