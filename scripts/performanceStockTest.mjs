import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

// Query builder fixture: real reader code, no production client or network.
const state = { calls: [], warehouses: [], levels: [], fail: null };
globalThis.performanceStockFixture = state;
const source = `const state=globalThis.performanceStockFixture;export const supabase={from(table){const filters=[];let range;const q={select(){return q},eq(k,v){filters.push([k,'eq',v]);return q},in(k,v){filters.push([k,'in',v]);return q},order(){return q},range(a,b){range=[a,b];return q},maybeSingle(){return run(true)},then(resolve,reject){return run(false).then(resolve,reject)}};async function run(single){state.calls.push({table,filters,range});if(state.fail===table)return {data:null,error:{message:'read failed'}};let rows=(table==='stock_warehouses'?state.warehouses:state.levels).filter(row=>filters.every(([k,op,v])=>k==='product.is_active'||(op==='eq'?row[k]===v:v.includes(row[k]))));if(range)rows=rows.slice(range[0],range[1]+1);if(single&&rows.length>1)return {data:null,error:{message:'multiple warehouses'}};return {data:single?(rows[0]||null):rows,error:null}}return q}};`;
const built = await build({ entryPoints: ['src/features/supervision/buildingSupervisionStorage.ts'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'local-reader', setup(p) {
  p.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({ path: 'client', namespace: 'fixture' }));
  p.onResolve({ filter: /^@\/services\/taskStorage$/ }, () => ({ path: 'tasks', namespace: 'fixture' }));
  p.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'client' ? source : 'export const taskStorageService={};', loader: 'js' }));
} }] });
const reader = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const ids = Array.from({ length: 20 }, (_, i) => 'b' + i);
state.warehouses = ids.map(id => ({ id: 'w' + id, name: id, property_group_id: id, location_type: 'building_storage', is_active: true }));
state.levels = ids.map(id => ({ id: 'l' + id, warehouse_id: 'w' + id, product_id: 'p', current_quantity: 3, minimum_quantity: 1, target_quantity: 5 }));
async function read(ids) {
  return reader.getBuildingsStockLevels ? reader.getBuildingsStockLevels(ids) : Object.fromEntries(await Promise.all(ids.map(async id => [id, await reader.getBuildingStockLevels(id)])));
}
const result = await read(ids);
for (const id of ids) assert.equal(result[id][0].id, 'l' + id);
const metrics = { buildings: ids.length, stockRequests: state.calls.length };
console.log(JSON.stringify(metrics));
if (process.env.PERFORMANCE_RESULT) writeFileSync(process.env.PERFORMANCE_RESULT, JSON.stringify(metrics, null, 2));
if (!process.argv.includes('--measure')) {
  assert.equal(metrics.stockRequests, 2);
  state.calls = []; assert.deepEqual(await read([]), {}); assert.equal(state.calls.length, 0);
  assert.deepEqual(await read(['missing']), { missing: [] });
  state.fail = 'stock_warehouses'; await assert.rejects(read(ids), e => e.message === 'read failed');
  state.fail = 'stock_levels'; await assert.rejects(read(ids), e => e.message === 'read failed'); state.fail = null;
  state.warehouses.push({ ...state.warehouses[0], id: 'duplicate' });
  await assert.rejects(read(ids), /trastero|warehouse/i); state.warehouses.pop();
  state.levels = Array.from({ length: 1201 }, (_, i) => ({ ...state.levels[0], id: 'level' + i }));
  assert.equal((await read([ids[0]]))[ids[0]].length, 1201, 'Never truncate batched stock at the API row limit');
  assert.equal((await reader.getBuildingStockLevels(ids[0])).length, 1201, 'Single-building API shares the complete reader');
}
delete globalThis.performanceStockFixture;
