import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';import {randomUUID}from'node:crypto';
import {stockBagDatabase}from'./stockBagAccountingTestSupport.mjs';
const migration=await readFile(new URL('../supabase/migrations/20261015173000_laundry_replenishment_start.sql',import.meta.url),'utf8');
let checks=0;
async function fixture(name,run){const t=await stockBagDatabase();try{await t.db.exec(migration);await run(t);console.log('OK '+name);checks++;}finally{await t.db.close();}}
async function prepareFull(t,unknown=false){
 await t.activate();await t.db.query('UPDATE stock_bag_accounting_config SET active=false WHERE sede_id=$1',[t.sede]);
 await t.configure('all',false,'central','central');
 if(unknown)await t.db.query("UPDATE laundry_cycle_config SET opening_unknown_kinds=ARRAY['outside'] WHERE sede_id=$1",[t.sede]);
 const counts=t.counts.filter(c=>!unknown||c.kind!=='outside').map(c=>c.kind==='clean'&&c.warehouseId===t.building&&c.productId===t.productMap.bath_towels?{...c,quantity:2}:c);
 await t.rpc('open_laundry_cycle_checked',{_sede:t.sede,_counts:counts,_measured:new Date(Date.now()-1000).toISOString()});
}
async function activate(t){await t.rpc('activate_laundry_cycle_checked',{_sede:t.sede});}
async function task(t,property=t.property){
 const id=randomUUID();await t.db.query("INSERT INTO tasks(id,propiedad_id,sede_id,date,type,status) VALUES($1,$2,$3,$4,'limpieza-turistica','pending')",[id,property,t.sede,t.date]);
 await t.db.query('UPDATE laundry_share_links SET snapshot_task_ids=array_append(snapshot_task_ids,$1) WHERE id=$2',[id,t.link]);return id;
}
async function spare(t,property=t.property,destination=t.building){
 const key=randomUUID();await t.db.query("INSERT INTO laundry_cycle_bags(task_key,property_id,sede_id,property_code,central_id,destination_id,state,lines,delivered_at) VALUES($1,$2,$3,'DEMO',$4,$5,'delivered',$6,now()-interval '1 minute')",[key,property,t.sede,t.central,destination,[{productId:t.productMap.bath_towels,quantity:2}]]);return key;
}
const quantity=async(t,warehouse=t.building)=>Number((await t.db.query('SELECT current_quantity FROM stock_levels WHERE warehouse_id=$1 AND product_id=$2',[warehouse,t.productMap.bath_towels])).rows[0]?.current_quantity??0);
const snap=t=>({stockChangedAt:null,stockConsumables:[{productId:t.soap,quantity:1}],amenities:{trashSacks100L:1}});
await fixture('clean first from stored spare, replenish later, and consume amenities only once',async t=>{
 await prepareFull(t,true);const opening=await spare(t);await activate(t);const id=await task(t),before=Number((await t.level(t.soap)).current_quantity);
 await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[id]);assert.equal(await quantity(t),0);
 assert.equal((await t.db.query("SELECT state FROM laundry_cycle_bags WHERE task_key=$1",[opening])).rows[0].state,'used');
 assert.equal((await t.db.query("SELECT count(*)::int n FROM laundry_cycle_issues WHERE code='cleaning_failed' AND resolved_at IS NULL")).rows[0].n,0);
 await t.route(id,'prepare',{snapshot:snap(t)});assert.equal(await quantity(t,t.central),10);assert.equal(Number((await t.level(t.soap)).current_quantity),before-1);
 await t.route(id,'prepare',{snapshot:snap(t)});assert.equal(Number((await t.level(t.soap)).current_quantity),before-1);
 await t.route(id,'deliver');assert.equal(await quantity(t),2);assert.equal(await quantity(t,t.central),8);
 await t.rpc('retry_laundry_cycle_checked',{_task:id});assert.equal(await quantity(t),2);
 const second=await task(t);await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[second]);assert.equal(await quantity(t),0);
 await t.route(second,'prepare',{snapshot:snap(t)});await t.route(second,'deliver');assert.equal(await quantity(t),2);
 await t.route(second,'collect');assert.equal(Number((await t.db.query('SELECT quantity FROM laundry_cycle_collected WHERE sede_id=$1 AND product_id=$2',[t.sede,t.productMap.bath_towels])).rows[0].quantity),4);
 const state=await t.rpc('laundry_cycle_stock_checked',{_sede:t.sede,_from:t.date,_to:t.date});assert.ok(state.tasks.some(x=>x.taskId===id&&x.state==='delivered'));
});
await fixture('unknown laundry opening is not a zero count and real receipt still adds stock',async t=>{
 await prepareFull(t,true);await activate(t);
 assert.equal((await t.db.query("SELECT count(*)::int n FROM laundry_cycle_openings WHERE kind='outside'")).rows[0].n,0);
 assert.equal((await t.db.query('SELECT count(*)::int n FROM laundry_cycle_pool')).rows[0].n,0);
 await t.mutate({action:'start'});await t.mutate({action:'add',material:'bath_towels',quantity:5});const s=await t.state();
 const operation=randomUUID();await t.mutate({action:'confirm',expectedRevision:s.receipt.revision},{id:operation});assert.equal(await quantity(t,t.central),15);
 await t.mutate({action:'confirm',expectedRevision:s.receipt.revision},{id:operation});assert.equal(await quantity(t,t.central),15);
 const view=await t.rpc('read_laundry_cycle_checked',{_sede:t.sede});assert.deepEqual(view.config.opening_unknown_kinds,['outside']);
});
await fixture('direct property uses its opening spare without inventing a warehouse',async t=>{
 await prepareFull(t,true);await spare(t,t.solo,null);await activate(t);const id=await task(t,t.solo);const central=await quantity(t,t.central);
 await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[id]);assert.equal(await quantity(t,t.central),central);
 assert.equal(Number((await t.db.query('SELECT quantity FROM laundry_cycle_dirty WHERE property_id=$1 AND product_id=$2',[t.solo,t.productMap.bath_towels])).rows[0].quantity),2);
});
await fixture('opening-completed task is not consumed again; missing spare remains an issue',async t=>{
 await prepareFull(t,true);const done=await task(t);await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[done]);
 await assert.rejects(activate(t),/ya realizadas/);
 await t.db.query("INSERT INTO laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload) VALUES($1,$2,$3,$3,$4,'opening_cleaning',$5)",['opening:'+done,t.sede,done,t.property,{date:t.date,source:'user_declared_opening'}]);
 await activate(t);const result=await t.rpc('retry_laundry_cycle_checked',{_task:done});assert.equal(result.includedInOpening,true);
 const id=await task(t);await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[id]);
 assert.equal((await t.db.query("SELECT count(*)::int n FROM laundry_cycle_issues WHERE task_key=$1 AND code='cleaning_failed' AND resolved_at IS NULL",[id])).rows[0].n,1);
});
await fixture('unpack restores only actual consumables once and preserves physical linen',async t=>{
 await prepareFull(t,true);await activate(t);const id=await task(t),before=Number((await t.level(t.soap)).current_quantity);
 await t.route(id,'prepare',{snapshot:snap(t)});const bag=(await t.db.query('SELECT id FROM laundry_cycle_bags WHERE task_key=$1',[id])).rows[0].id;
 const args={_bag:bag,_action:'unpack',_reason:'Bolsa realmente deshecha',_operation:randomUUID()};
 await t.rpc('resolve_laundry_cycle_bag_checked',args);await t.rpc('resolve_laundry_cycle_bag_checked',args);
 assert.equal(Number((await t.level(t.soap)).current_quantity),before);assert.equal(await quantity(t,t.central),10);
 await t.route(id,'prepare',{snapshot:snap(t)});assert.equal(Number((await t.level(t.soap)).current_quantity),before-1);
 await t.route(id,'deliver');const returned={_bag:bag,_action:'return',_reason:'Bolsa limpia devuelta',_operation:randomUUID()};
 await t.rpc('resolve_laundry_cycle_bag_checked',returned);await t.rpc('resolve_laundry_cycle_bag_checked',returned);
 assert.equal(Number((await t.level(t.soap)).current_quantity),before);assert.equal(await quantity(t,t.central),10);
});
await fixture('receipt-only unused linen does not demand an invented physical count',async t=>{
 await t.activate();for(const product of [t.productMap.bath_towels,t.soap,t.sack])await t.adjust(product,'ajuste',Math.max(0,Number((await t.level(product)).current_quantity)),{verified:true});
 await t.rpc('close_stock_bag_accounting_checked',{_sede:t.sede,_operation:randomUUID()});
 assert.equal((await t.db.query('SELECT active FROM stock_bag_accounting_config WHERE sede_id=$1',[t.sede])).rows[0].active,false);
});
await fixture('historical draft stays untouched and cannot add old stock after opening',async t=>{
 const before=(await t.db.query('SELECT ($1::date-1)::text d',[t.date])).rows[0].d;
 await t.mutate({action:'start'},{date:before});await t.mutate({action:'add',material:'pillowcases',quantity:50},{date:before});
 const old=await t.state({date:before});await prepareFull(t,true);await activate(t);
 const quantityBefore=Number((await t.level(t.productMap.pillowcases)).current_quantity);
 await assert.rejects(t.mutate({action:'confirm',expectedRevision:old.receipt.revision},{date:before}),/histórica/);
 assert.equal(Number((await t.level(t.productMap.pillowcases)).current_quantity),quantityBefore);
 assert.equal((await t.state({date:before})).receipt.latest_version,0);
});
console.log('PASS '+checks+' operational replenishment scenarios; isolated PGlite and no production writes.');

