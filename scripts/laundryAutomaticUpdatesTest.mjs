import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { build } from 'esbuild';

globalThis.Deno = { serve() {} };
async function loadFunctions(file, names) {
  const result = await build({
    stdin: {contents: readFileSync(file, 'utf8') + `\nexport { ${names.join(',')} };`, resolveDir: dirname(resolve(file)), loader:'ts'},
    bundle:true, write:false, format:'esm', platform:'node',
    plugins:[{name:'no-network',setup(builder) {
      builder.onResolve({filter:/^(npm:|https:)/}, () => ({path:'stub',namespace:'stub'}));
      builder.onLoad({filter:/.*/,namespace:'stub'}, () => ({contents:'export function createClient() {throw new Error("No production access in tests")}; export function serve() {}'}));
    }}],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const management = await loadFunctions('supabase/functions/manage-laundry-route-v2-links/index.ts', ['reconcileLink','bagContent','taskSignature']);
const workflow = await loadFunctions('supabase/functions/laundry-route-workflow/index.ts', ['mapTask','fetchTasksForDates','upsertPreparation']);
const tables = {
  tasks: [], laundry_bag_preparations: [], laundry_route_v2_bag_snapshots: [],
  laundry_share_links: [{id:'link',snapshot_task_ids:[],last_synced_at:null}],
  laundry_classic_route_order: [], laundry_route_v2_events: [],
};
const clone = value => structuredClone(value);
const db = {from(table) {
  let filters = [], op = 'select', payload, single = false;
  const query = {
    select(){return query;}, order(){return query;},
    in(key,values){filters.push(row => values.includes(row[key]));return query;},
    eq(key,value){filters.push(row => row[key] === value);return query;},
    update(value){op='update';payload=value;return query;},
    insert(value){op='insert';payload=value;return query;},
    upsert(value){op='upsert';payload=value;return query;},
    single(){single=true;return query;},
    then(resolve) {
      let rows = tables[table].filter(row => filters.every(filter => filter(row)));
      if(op === 'update') rows.forEach(row => Object.assign(row,clone(payload)));
      if(op === 'insert' || op === 'upsert') {
        let row = op === 'upsert' ? tables[table].find(row => payload.event_key ? row.event_key === payload.event_key : row.task_id === payload.task_id) : null;
        if(row) Object.assign(row,clone(payload));
        else {row = {id:`${table}-${tables[table].length}`, ...clone(payload)};tables[table].push(row);}
        rows=[row];
      }
      return Promise.resolve({data:clone(single ? rows[0] : rows),error:null}).then(resolve);
    },
  };return query;
}};
const task = {id:'one',date:'2026-09-09',sede_id:'sede',type:'limpieza-turistica',status:'pending',cleaner:'Ana',properties:{id:'property',is_active:true,linen_control_enabled:true,numero_sabanas:2}};
tables.tasks.push(clone(task));
const link = () => ({...tables.laundry_share_links[0],delivery_date:'2026-09-09',filters:{routeDates:['2026-09-09'],nextRouteDates:['2026-09-10'],nextDeliveryDate:'2026-09-11'}});
const sync = () => management.reconcileLink(db, link(), 'sede', {name:'Hoy'}, {name:'Siguiente'}, {kind:'cron'});
await sync();
assert.equal(tables.laundry_bag_preparations[0].status, 'pending', 'New tasks enter preparation automatically');
assert.equal(tables.laundry_bag_preparations[0].route_novelty_resolved, true);
tables.laundry_bag_preparations[0].status = 'prepared';
tables.tasks[0].status = 'completed';
tables.tasks[0].cleaner = 'Otra persona';
tables.tasks[0].check_in = '2026-09-10';
await sync();
assert.equal(tables.laundry_bag_preparations[0].status, 'prepared', 'Cleaning status and metadata must not reopen a bag');
tables.tasks[0].properties.numero_sabanas = 5;
await sync();
assert.equal(tables.laundry_bag_preparations[0].status, 'pending', 'Textile changes reopen the physical work, not an approval');
assert.equal(tables.laundry_bag_preparations[0].content_snapshot.textiles.sheets, 5);
assert.equal(tables.laundry_bag_preparations[0].route_novelty_resolved, true);
tables.laundry_bag_preparations[0].status = 'prepared';
await sync();
assert.equal(tables.laundry_bag_preparations[0].status, 'prepared', 'Repeated synchronization must be idempotent');
tables.tasks[0].status = 'cancelled';
await sync();
assert.deepEqual(tables.laundry_share_links[0].snapshot_task_ids, [], 'Cancelled tasks leave the route automatically');
assert.deepEqual(await workflow.fetchTasksForDates(db, ['2026-09-09'], 'sede'), [], 'Public links must exclude cancellations too');
assert.equal(tables.laundry_bag_preparations[0].route_novelty_resolved, true);
assert.ok(tables.laundry_route_v2_events.length, 'Audit history is preserved');
const preparations = new Map([['one',{status:'prepared',content_snapshot:management.bagContent(task)}]]);
const mapped = workflow.mapTask({...task,properties:{...task.properties,numero_sabanas:7}},preparations,new Map(),new Map(),new Set());
assert.equal(mapped.textiles.sheets,7);
assert.equal(mapped.bagStatus.status,'pending','Open links use live quantities even before periodic reconciliation');
const current = workflow.mapTask(task,new Map(),new Map(),new Map([['property',[{productId:'soap',quantity:1}]]]),new Set());
await workflow.upsertPreparation(db,'link','one','prepared',undefined,null,current);
assert.deepEqual(tables.laundry_bag_preparations[0].content_snapshot.stockConsumables, current.stockConsumables);
const stockChanged = workflow.mapTask(task,new Map([['one',tables.laundry_bag_preparations[0]]]),new Map(),new Map([['property',[{productId:'soap',quantity:3}]]]),new Set());
assert.equal(stockChanged.bagStatus.status,'pending','Stock-rule changes also reopen the bag');
const page = readFileSync('src/pages/LaundryRouteV2Management.tsx','utf8');
assert.doesNotMatch(page,/Autorizar continuar|Novedades y actividad|authorize_continue|Requiere revisión/);
console.log('PASS: additions, cancellations, material/stock changes, metadata-only updates, idempotency, audit preservation, no approvals');
