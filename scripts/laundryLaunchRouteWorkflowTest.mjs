import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Execute the complete Edge handler with its real shared modules. All Supabase
// calls are in-memory fixtures; any fetch fails before it can reach the network.
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('External network forbidden'); };
globalThis.Deno = { env: { get: key => ({ SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' })[key] } };
const load = async (path) => {
  const built = await build({
    entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'offline-edge', setup(b) {
      b.onResolve({ filter: /^https:\/\/deno\.land\/std@.+\/http\/server\.ts$/ }, () => ({ path: 'serve', namespace: 'fixture' }));
      b.onResolve({ filter: /^npm:@supabase\/supabase-js@/ }, () => ({ path: 'db', namespace: 'fixture' }));
      b.onResolve({ filter: /^\.\.\/_shared\// }, a => ({ path: resolve('supabase/functions/_shared', a.path.split('/').at(-1)) }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'serve'
        ? 'export const serve=handler=>{globalThis.fixtureHandler=handler;};'
        : 'export const createClient=()=>globalThis.fixtureDb;' }));
    } }],
  });
  await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
  return globalThis.fixtureHandler;
};
const sede = 'sede-fixture', task = 'task-fixture', link = 'link-fixture';
const sessionToken = 'synthetic-session';
const worker = { id: 'worker-fixture', cleaner_id: 'cleaner-fixture', sede_id: sede, is_active: true,
  cleaners: { id: 'cleaner-fixture', name: 'Persona de prueba', is_active: true } };
const property = { id: 'property-fixture', sede_id: sede, codigo: 'DEMO', linen_control_enabled: true,
  is_active: true, numero_toallas_grandes: 2, clients: { is_active: true, linen_control_enabled: true } };
function database(options = {}) {
  const calls = [];
  const rows = {
    laundry_share_links: [{ id: link, token: 'synthetic-link', sede_id: sede, is_active: true,
      workflow_version: 'route_v2', date_end: '2026-10-13', snapshot_task_ids: [task], original_task_ids: [task],
      filters: { deliveryDate: '2026-10-13', routeDates: ['2026-10-13'], nextDeliveryDate: '2026-10-16', nextRouteDates: ['2026-10-16'] } }],
    laundry_delivery_schedule: [
      { id: 'tuesday', sede_id: sede, day_of_week: 2, collection_days: [2], sort_order: 0, is_active: true },
      { id: 'friday', sede_id: sede, day_of_week: 5, collection_days: [5], sort_order: 1, is_active: true },
    ],
    tasks: [{ id: task, sede_id: sede, propiedad_id: property.id, date: options.nextTask ? '2026-10-16' : '2026-10-13',
      type: 'limpieza-turistica', status: options.cancelled ? 'cancelled' : 'pending', properties: structuredClone(property) }],
    laundry_classic_route_order: [], stock_property_consumption_rules: [],
    laundry_bag_preparations: [{ task_id: task, status: options.partialPending ? 'pending' : 'prepared', prepared_at: '2026-10-13T07:00:00Z' }],
    laundry_delivery_tracking: [],
    laundry_route_workers: options.workers ? [worker] : [],
    laundry_route_sessions: [{ id: 'session-fixture', share_link_id: link,
      token_hash: createHash('sha256').update(sessionToken).digest('hex'),
      revoked_at: null, expires_at: '2099-01-01T00:00:00Z', laundry_route_workers: worker }],
    stock_sede_settings: options.missingSettings ? [] : [{ sede_id: sede, laundry_route_inventory_enabled: options.enabled === true }],
  };
  const get = (row, key) => key.split('.').reduce((v, k) => v?.[k], row);
  return { calls, from(table) {
    if (!Object.hasOwn(rows, table) && table !== 'laundry_route_worker_events') throw new Error(`Unexpected table ${table}`);
    const predicates = []; let single = false, mutation = null;
    const q = {
      select() { return q; }, order() { return q; }, or() { return q; },
      eq(key, value) { predicates.push(row => get(row, key) === value); return q; },
      in(key, values) { predicates.push(row => values.includes(get(row, key))); return q; },
      is(key, value) { return q.eq(key, value); },
      gt(key, value) { predicates.push(row => get(row, key) > value); return q; },
      maybeSingle() { single = true; return q; },
      update(payload) { mutation = { kind: 'update', payload }; return q; },
      insert(payload) { mutation = { kind: 'insert', payload }; return q; },
      upsert(payload) { mutation = { kind: 'upsert', payload }; return q; },
      then(yes, no) {
        calls.push({ table, mutation });
        if (table === 'stock_sede_settings' && options.settingsError) return Promise.resolve({ data: null, error: { message: 'No se pudo leer la configuración' } }).then(yes, no);
        const result = (rows[table] ?? []).filter(row => predicates.every(p => p(row)));
        return Promise.resolve({ data: single ? result[0] ?? null : result, error: null }).then(yes, no);
      },
    }; return q;
  }, async rpc(name, args) {
    calls.push({ rpc: name, args });
    if (name === 'stock_bag_accounting_route_state') return {data:{active:options.partial===true,bags:[]},error:options.bagStateError?{code:'XX000',message:'Cannot read bag mode'}:null};
    if (name === 'laundry_cycle_eligible') return options.cycleReadFailure ? {data:null,error:{message:'Cannot read cycle',code:'XX000'}} : {data:options.cycle === true,error:options.cycleMissing?{code:'PGRST202'}:null};
    if (name === 'laundry_cycle_preview') return {data:options.cycle ? [{taskId:task,generation:0,dirtyLines:[],lines:[{productId:'towel-fixture',propertyField:'numero_toallas_grandes',quantity:4,name:'Toalla',unit:'unidades'}]}] : [],error:options.cycleMissing?{code:'PGRST202'}:null};
    return options.rpcError ? { data: null, error: { message: options.rpcError } }
      : { data: { processed: options.replay ? 0 : 1, skipped: options.replay ? 1 : 0 }, error: null };
  } };
}
const invoke = async (handler, options = {}, payload = {}) => {
  const db = database(options); globalThis.fixtureDb = db;
  const response = await handler(new Request('https://fixture.invalid', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'synthetic-link', taskId: task, action: 'deliver', ...(options.cycle?{expectedBag:{propertyId:property.id,date:'2026-10-13',cycleGeneration:0,dirtyLines:[],cycleLines:[{productId:'towel-fixture',quantity:4}]}}:{}), ...payload }),
  }));
  return { status: response.status, data: await response.json(), calls: db.calls };
};
const rpcs = r => r.calls.filter(c => c.rpc && !['laundry_cycle_eligible','laundry_cycle_preview','stock_bag_accounting_route_state'].includes(c.rpc));
const trackingWrites = r => r.calls.filter(c => c.table === 'laundry_delivery_tracking' && c.mutation);
const workerWrites = r => r.calls.filter(c => c.table === 'laundry_route_worker_events' && c.mutation);
try {
  const deployedShared = JSON.parse(await readFile('scripts/fixtures/laundryRouteSharedDeployed20261013.json', 'utf8'));
  for (const file of deployedShared) {
    const current = await readFile('supabase/' + file.name, 'utf8');
    assert.equal(current.replaceAll('\r\n', '\n').trimEnd(), file.content.replaceAll('\r\n', '\n').trimEnd(), `Preserve deployed dependency ${file.name}`);
  }
  const baseline = await load('scripts/fixtures/laundryRouteWorkflowDeployed20261013.ts');
  const red = await invoke(baseline);
  assert.equal(red.status, 200);
  assert.equal(rpcs(red)[0].rpc, 'process_laundry_route_inventory_event');
  assert.equal(trackingWrites(red).length, 1);
  console.log('CONFIRMED deployed v83 calls physical stock with the flag disabled, then writes tracking separately.');

  const fixed = await load('supabase/functions/laundry-route-workflow/index.ts');
  let count = 0;
  for (const action of ['collect', 'deliver']) {
    for (const missingSettings of [false, true]) {
      const result = await invoke(fixed, { missingSettings, workers: true }, { action, sessionToken });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      assert.equal(rpcs(result).length, 0);
      assert.equal(trackingWrites(result).length, 1);
      assert.equal(workerWrites(result).length, 1);
      count++;
    }
    const active = await invoke(fixed, { enabled: true, workers: true }, { action, sessionToken });
    assert.equal(active.status, 200, JSON.stringify(active.data));
    assert.deepEqual(rpcs(active), [{ rpc: 'process_laundry_route_inventory_and_tracking', args: {
      _task_id: task, _action: action, _share_link_id: link, _route_worker_id: worker.id,
      _cleaner_id: worker.cleaner_id, _worker_name: worker.cleaners.name,
    } }]);
    assert.equal(trackingWrites(active).length, 0, 'tracking belongs to the database transaction');
    assert.equal(workerWrites(active).length, 0, 'the transaction already records the worker');
    count++;
    const replay = await invoke(fixed, { enabled: true, replay: true }, { action });
    assert.equal(replay.status, 200); assert.equal(rpcs(replay).length, 1);
    assert.equal(trackingWrites(replay).length, 0); count++;
  }
  for (const message of ['No hay suficiente stock limpio', 'Linen bag changed after preparation', 'Laundry route inventory is not enabled for this sede']) {
    const failed = await invoke(fixed, { enabled: true, workers: true, rpcError: message }, { sessionToken });
    assert.equal(failed.status, 500); assert.equal(failed.data.success, undefined);
    assert.equal(trackingWrites(failed).length, 0); assert.equal(workerWrites(failed).length, 0); count++;
  }
  const settingsFailure = await invoke(fixed, { settingsError: true });
  assert.equal(settingsFailure.status, 500); assert.equal(rpcs(settingsFailure).length, 0);
  assert.equal(trackingWrites(settingsFailure).length, 0); count++;
  for (const options of [{ cancelled: true }, { nextTask: true }, { workers: true }]) {
    const denied = await invoke(fixed, { enabled: true, ...options });
    assert.ok([400, 401].includes(denied.status)); assert.equal(rpcs(denied).length, 0);
    assert.equal(trackingWrites(denied).length, 0); count++;
  }
  const prepared = await invoke(fixed, {}, { action: 'prepare' });
  assert.equal(prepared.status, 200); assert.equal(rpcs(prepared).length, 0);
  assert.equal(trackingWrites(prepared).length, 0);
  assert.equal(prepared.calls.filter(c => c.table === 'laundry_bag_preparations' && c.mutation).length, 1); count++;
  const loaded = await invoke(fixed, {}, { action: 'load' });
  assert.equal(loaded.status, 200); assert.equal(rpcs(loaded).length, 0); count++;
  for (const action of ['prepare','collect','deliver','issue']) {
    const result=await invoke(fixed,{cycle:true,workers:true},{action,sessionToken,issueReason:'Incidencia comprobada',workerName:'Untrusted name',routeWorkerId:'untrusted'});
    assert.equal(result.status,200,JSON.stringify(result.data));
    assert.equal(rpcs(result).length,1); assert.equal(rpcs(result)[0].rpc,'laundry_cycle_route');
    assert.equal(rpcs(result)[0].args._worker,worker.id); assert.equal(rpcs(result)[0].args._name,worker.cleaners.name);
    assert.equal(trackingWrites(result).length,0);assert.equal(workerWrites(result).length,0); count++;
  }
  const cycleLoaded=await invoke(fixed,{cycle:true},{action:'load'}); assert.equal(cycleLoaded.status,200);
  assert.equal(cycleLoaded.data.workflow.currentRouteBags[0].textiles.towelsLarge,4);count++;
  const cycleFailed=await invoke(fixed,{cycle:true,workers:true,rpcError:'No hay ropa disponible'},{sessionToken});
  assert.equal(cycleFailed.status,500);assert.equal(trackingWrites(cycleFailed).length,0);count++;
  const missing=await invoke(fixed,{cycleMissing:true,workers:true},{sessionToken});assert.equal(missing.status,200);assert.equal(rpcs(missing).length,0);count++;
  const readFailed=await invoke(fixed,{cycleReadFailure:true,workers:true},{sessionToken});assert.equal(readFailed.status,500);assert.equal(trackingWrites(readFailed).length,0);count++;
  const stale=await invoke(fixed,{cycle:true,workers:true},{action:'prepare',sessionToken,expectedBag:{propertyId:property.id,date:'2026-10-13',cycleGeneration:0,dirtyLines:[],cycleLines:[{productId:'towel-fixture',quantity:2}]}});assert.equal(stale.status,409);assert.equal(rpcs(stale).length,0);count++;
  const oldClient=await invoke(fixed,{cycle:true,workers:true},{sessionToken,expectedBag:null});assert.equal(oldClient.status,409);assert.equal(rpcs(oldClient).length,0);count++;
  const partialExpected={propertyId:property.id,date:'2026-10-13',stockChangedAt:null,textiles:{towelsLarge:2},amenities:{},stockConsumables:[]};
  const partial=await invoke(fixed,{partial:true},{action:'prepare',expectedBag:partialExpected});
  assert.equal(partial.status,200);assert.equal(partial.data.workflow.stockTrackingMode,'partial');assert.equal(partial.data.workflow.inventoryCycleEnabled,true);count++;
  for(const expectedBag of [null,{...partialExpected,textiles:{towelsLarge:99}},{...partialExpected,stockConsumables:undefined}]){
   const denied=await invoke(fixed,{partial:true},{action:'prepare',expectedBag});assert.equal(denied.status,409);assert.equal(denied.calls.filter(c=>c.table==='laundry_bag_preparations'&&c.mutation).length,0);count++;
  }
  const pendingPartial=await invoke(fixed,{partial:true,partialPending:true},{action:'deliver'});assert.equal(pendingPartial.status,409);assert.equal(trackingWrites(pendingPartial).length,0);count++;
  const partialDelivery=await invoke(fixed,{partial:true},{action:'deliver',expectedBag:partialExpected});assert.equal(partialDelivery.status,200);assert.equal(rpcs(partialDelivery).length,1);assert.equal(rpcs(partialDelivery)[0].rpc,'deliver_stock_bag_checked');assert.equal(trackingWrites(partialDelivery).length,0);count++;
  const staleDelivery=await invoke(fixed,{partial:true},{action:'deliver',expectedBag:{...partialExpected,stockChangedAt:'2020-01-01'}});assert.equal(staleDelivery.status,409);assert.equal(rpcs(staleDelivery).length,0);count++;
  const failedBagRead=await invoke(fixed,{bagStateError:true},{action:'prepare',expectedBag:partialExpected});assert.equal(failedBagRead.status,500);assert.equal(failedBagRead.calls.filter(c=>c.mutation).length,0);count++;
  // The deployed dependency pack is held unchanged by this correction.
  const source = await readFile('supabase/functions/laundry-route-workflow/index.ts', 'utf8');
  assert.ok(source.includes('preparationTrashSackQuantity'));
  console.log(`PASS ${count} complete Edge requests: inactive/missing flag, active atomic RPC, actor, retries, stock failure, stale bag, flag race, read failure, cancelled/next route, PIN and preparation. No external network.`);
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.fixtureDb; delete globalThis.fixtureHandler; delete globalThis.Deno;
}
