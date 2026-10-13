import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {completeCycleDatabase} from './laundryCompleteCycleTestSupport.mjs';
let checks=0;
async function fixture(label,run){const t=await completeCycleDatabase();try{await run(t);checks++;console.log('OK '+label);}finally{await t.db.close();}}
const balance=async(t,table)=>Number((await t.db.query(`SELECT coalesce(sum(quantity),0) n FROM ${table} WHERE product_id=$1`,[t.productMap.bath_towels])).rows[0].n);
const stock=async t=>Number((await t.db.query('SELECT current_quantity FROM stock_levels WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels])).rows[0].current_quantity);
try{
await fixture('missing category prevents activation; unknown never means zero',async t=>{
 await t.configure();await t.rpc('open_laundry_cycle_checked',{_sede:t.sede,_counts:t.counts.filter(c=>!(c.kind==='dirty'&&c.propertyId===t.solo)),_measured:new Date(Date.now()-1000).toISOString()});
 await assert.rejects(t.activate(),/Faltan categorías/);await t.open();await t.activate();
 await assert.rejects(t.db.query('UPDATE stock_sede_settings SET auto_consumption_enabled=true WHERE sede_id=$1',[t.sede]),/motores anteriores/);
});
await fixture('central collection, partial dispatch, UUID replay and stale quantities',async t=>{
 await t.configure('all',false,'central');await t.open();await t.activate();await t.route(t.task,'prepare');await t.route(t.task,'deliver');await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[t.task]);await t.route(t.second,'collect');
 assert.equal(await balance(t,'laundry_cycle_collected'),2); const op=randomUUID();const args={_sede:t.sede,_lines:[{productId:t.productMap.bath_towels,quantity:1,expectedQuantity:2}],_reason:'Envío parcial comprobado',_operation:op};
 await t.rpc('laundry_cycle_send_checked',args);await t.rpc('laundry_cycle_send_checked',args);assert.equal(await balance(t,'laundry_cycle_collected'),1);assert.equal(await balance(t,'laundry_cycle_pool'),3);
 await assert.rejects(t.rpc('laundry_cycle_send_checked',{...args,_operation:randomUUID()}),/supera/);
 const loss={_sede:t.sede,_product:t.productMap.bath_towels,_quantity:1,_reason:'Pérdida confirmada por recuento',_operation:randomUUID()};await t.rpc('laundry_cycle_writeoff_checked',loss);await t.rpc('laundry_cycle_writeoff_checked',loss);assert.equal(await balance(t,'laundry_cycle_pool'),2);
});
await fixture('initial collected dirty stock is counted centrally once and can be dispatched',async t=>{
 await t.configure('all',false,'central','central');
 const opening=t.counts.find(r=>r.productId===t.productMap.bath_towels && r.kind==='collected');opening.quantity=3;
 const args={_sede:t.sede,_counts:t.counts.filter(r=>r.kind!=='collected'),_measured:new Date(Date.now()-5000).toISOString()};
 await t.rpc('open_laundry_cycle_checked',args);await assert.rejects(t.activate(),/categorías/);
 await assert.rejects(t.rpc('open_laundry_cycle_checked',{...args,_counts:[...args._counts,{...opening,warehouseId:t.building}]}),/central/);
 await t.open();await t.open();await t.activate();assert.equal(await balance(t,'laundry_cycle_collected'),3);assert.equal(await balance(t,'laundry_cycle_dirty'),0);assert.equal(await balance(t,'laundry_cycle_pool'),2);
 const send={_sede:t.sede,_lines:[{productId:t.productMap.bath_towels,quantity:3,expectedQuantity:3,source:'collected'}],_reason:'Sucia inicial contada en central',_operation:randomUUID()};
 await t.rpc('laundry_cycle_send_checked',send);await t.rpc('laundry_cycle_send_checked',send);assert.equal(await balance(t,'laundry_cycle_collected'),0);assert.equal(await balance(t,'laundry_cycle_pool'),5);
});
await fixture('one set collects removed historical quantity, not new dotation',async t=>{
 await t.configure('one');await t.open();await t.activate();await t.db.query('UPDATE properties SET numero_toallas_grandes=4 WHERE id=$1',[t.property]);
 await t.route(t.task,'prepare');await t.route(t.task,'deliver');await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[t.task]);
 await t.db.query('UPDATE properties SET numero_toallas_grandes=6 WHERE id=$1',[t.property]);await t.route(t.second,'collect');assert.equal(await balance(t,'laundry_cycle_pool'),4);assert.equal(await balance(t,'laundry_cycle_dirty'),0);
});
await fixture('strict excess receipt rolls back confirmation, clean stock and outbox',async t=>{
 await t.configure('all',true);await t.open();await t.activate();await t.mutate({action:'start'});await t.mutate({action:'add',material:'bath_towels',quantity:3});const s=await t.state();
 await assert.rejects(t.mutate({action:'confirm',expectedRevision:s.receipt.revision}),/supera/);assert.equal(await stock(t),10);assert.equal(await balance(t,'laundry_cycle_pool'),2);assert.equal((await t.db.query('SELECT count(*) n FROM laundry_receipt_versions')).rows[0].n,0);
});
await fixture('pre-opening receipt corrections cannot replay absolute counted stock',async t=>{
 await t.mutate({action:'start'});await t.mutate({action:'add',material:'bath_towels',quantity:3});let s=await t.state();await t.mutate({action:'confirm',expectedRevision:s.receipt.revision});
 await t.configure();await t.open();await t.activate();s=await t.state();await t.mutate({action:'notes',notes:'Aclaración histórica',expectedRevision:s.receipt.revision});s=await t.state();await t.mutate({action:'confirm',expectedRevision:s.receipt.revision});assert.equal(await stock(t),10);assert.equal(await balance(t,'laundry_cycle_pool'),2);
 s=await t.state();await t.mutate({action:'set',material:'bath_towels',quantity:2,expectedRevision:s.receipt.revision});s=await t.state();await assert.rejects(t.mutate({action:'confirm',expectedRevision:s.receipt.revision}),/anterior al recuento/);assert.equal(await stock(t),10);
});
await fixture('unconfirmed receipt before count blocks cutover',async t=>{
 await t.mutate({action:'start'});await t.configure();await t.open();await assert.rejects(t.activate(),/recepciones pendientes/);
});
await fixture('physical return and re-preparation create a new generation',async t=>{
 await t.configure();await t.open();await t.activate();await t.route(t.task,'prepare');await t.route(t.task,'deliver');const b=(await t.db.query('SELECT id FROM laundry_cycle_bags WHERE task_key=$1',[t.task])).rows[0];
 await t.rpc('resolve_laundry_cycle_bag_checked',{_bag:b.id,_action:'return',_reason:'Bolsa devuelta sin utilizar',_operation:randomUUID()});assert.equal(await stock(t),10);assert.equal((await t.db.query('SELECT status FROM laundry_delivery_tracking WHERE task_id=$1',[t.task])).rows[0].status,'pending');assert.equal((await t.db.query('SELECT status FROM laundry_bag_preparations WHERE task_id=$1',[t.task])).rows[0].status,'pending');await t.route(t.task,'prepare');await t.route(t.task,'deliver');assert.equal(await stock(t),8);
});
await fixture('prepared counted bags are adopted once and can be physically unpacked',async t=>{
 await t.configure();const counts=t.counts.map(c=>c.kind==='clean'&&c.warehouseId===t.central&&c.productId===t.productMap.bath_towels?{...c,preparedQuantity:2}:c);
 await t.rpc('open_laundry_cycle_checked',{_sede:t.sede,_counts:counts,_measured:new Date(Date.now()-1000).toISOString()});await assert.rejects(t.activate(),/bolsas anteriores/);
 const args={_sede:t.sede,_bags:[{taskId:t.task,lines:[{productId:t.productMap.bath_towels,quantity:2}]}]};await t.rpc('laundry_cycle_adopt_checked',args);await t.rpc('laundry_cycle_adopt_checked',args);await t.activate();assert.equal(await stock(t),10);
 await assert.rejects(t.route(t.task,'deliver',{worker:randomUUID()}),/PIN/);
 await t.db.query("UPDATE tasks SET date=date+1 WHERE id=$1",[t.task]);await assert.rejects(t.route(t.task,'deliver'),/fecha/);assert.equal(await stock(t),10);
});
await fixture('incomplete stock rolls back the whole bag and no delivery tracking leaks',async t=>{
 await t.configure();await t.open();await t.activate();await t.db.query('UPDATE stock_levels SET current_quantity=1 WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels]);await assert.rejects(t.route(t.task,'prepare'),/suficiente/);
 assert.equal((await t.db.query('SELECT count(*) n FROM laundry_cycle_bags')).rows[0].n,0);assert.equal((await t.db.query('SELECT count(*) n FROM laundry_delivery_tracking')).rows[0].n,0);
});
await fixture('opening clean bags already at the property stay held until used',async t=>{
 await t.configure();const counts=t.counts.map(c=>c.kind==='clean'&&c.propertyId===t.solo&&c.productId===t.productMap.bath_towels?{...c,quantity:2,preparedQuantity:2}:c);
 await t.rpc('open_laundry_cycle_checked',{_sede:t.sede,_counts:counts,_measured:new Date(Date.now()-1000).toISOString()});
 const args={_sede:t.sede,_bags:[{taskId:t.direct,lines:[{productId:t.productMap.bath_towels,quantity:2}],state:'delivered'}]};await t.rpc('laundry_cycle_adopt_checked',args);await t.rpc('laundry_cycle_adopt_checked',args);await t.activate();
 assert.equal(await stock(t),10);await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[t.direct]);assert.equal(await stock(t),10);assert.equal(await balance(t,'laundry_cycle_dirty'),2);
});
await fixture('empty future dotation shows review without hiding physical stock',async t=>{
 await t.configure();await t.open();await t.activate();await t.db.query('UPDATE properties SET numero_toallas_grandes=0 WHERE id=$1',[t.property]);const result=await t.rpc('laundry_cycle_stock_checked',{_sede:t.sede,_from:t.date,_to:t.date});assert.equal(result.tasks.find(r=>r.taskId===t.task).state,'review');assert.equal(result.levels.find(r=>r.warehouseId===t.central&&r.productId===t.productMap.bath_towels).quantity,10);
});
await fixture('legacy direct tracking cannot claim an unrecorded physical movement',async t=>{
 await t.configure();await t.open();await t.activate();await assert.rejects(t.db.query("INSERT INTO laundry_delivery_tracking(share_link_id,task_id,status,collection_status) VALUES($1,$2,'delivered','pending')",[t.link,t.task]),/ruta nueva con PIN/);
 await assert.rejects(t.db.query("INSERT INTO laundry_delivery_tracking(share_link_id,task_id,status,collection_status) VALUES($1,$2,'pending','collected')",[t.link,t.task]),/ruta nueva con PIN/);
 await t.route(t.task,'prepare');await t.route(t.task,'prepare');assert.equal((await t.db.query("SELECT count(*) n FROM laundry_route_worker_events WHERE task_id=$1 AND action='prepare'",[t.task])).rows[0].n,1);
 const p=await t.rpc('laundry_cycle_preview',{_tasks:[t.task]});assert.equal(p[0].cycleState,'prepared');await t.route(t.task,'deliver');await t.route(t.task,'deliver');assert.equal((await t.db.query("SELECT count(*) n FROM laundry_route_worker_events WHERE task_id=$1 AND action='deliver'",[t.task])).rows[0].n,1);
});
await fixture('stored rejected linen moves to quarantine, relavado and acceptance once',async t=>{
 await t.configure('all',false,'laundry','central');await t.open();await t.activate();await t.mutate({action:'start'});await t.mutate({action:'add',material:'bath_towels',quantity:1});await t.mutate({action:'add_discard',material:'bath_towels',quantity:1});let s=await t.state();await t.mutate({action:'confirm',expectedRevision:s.receipt.revision});
 const rejected=async()=>Number((await t.db.query('SELECT current_quantity FROM laundry_rejected_stock WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels])).rows[0].current_quantity);
 assert.equal(await balance(t,'laundry_cycle_pool'),0);assert.equal(await rejected(),1);assert.equal(await stock(t),11);
 const args={_sede:t.sede,_lines:[{productId:t.productMap.bath_towels,source:'rejected',quantity:1,expectedQuantity:1}],_reason:'Devuelta para relavado',_operation:randomUUID()};await t.rpc('laundry_cycle_send_checked',args);await t.rpc('laundry_cycle_send_checked',args);assert.equal(await rejected(),0);assert.equal(await balance(t,'laundry_cycle_pool'),1);
 await t.mutate({action:'add',material:'bath_towels',quantity:1});s=await t.state();await t.mutate({action:'confirm',expectedRevision:s.receipt.revision});assert.equal(await stock(t),12);assert.equal(await balance(t,'laundry_cycle_pool'),0);assert.equal(await rejected(),0);
});
await fixture('rejected correction and explicit quarantine loss preserve actual transfers',async t=>{
 await t.configure('all',false,'laundry','central');await t.open();await t.activate();await t.mutate({action:'start'});await t.mutate({action:'add_discard',material:'bath_towels',quantity:2});let s=await t.state();await t.mutate({action:'confirm',expectedRevision:s.receipt.revision});
 s=await t.state();await t.mutate({action:'set_discard',material:'bath_towels',quantity:1,expectedRevision:s.receipt.revision});s=await t.state();await t.mutate({action:'confirm',expectedRevision:s.receipt.revision});assert.equal(await balance(t,'laundry_cycle_pool'),1);
 const args={_sede:t.sede,_product:t.productMap.bath_towels,_source:'rejected',_expected:1,_quantity:1,_reason:'Prenda inservible, baja comprobada',_operation:randomUUID()};await t.rpc('laundry_cycle_writeoff_checked',args);await t.rpc('laundry_cycle_writeoff_checked',args);assert.equal(Number((await t.db.query('SELECT current_quantity FROM laundry_rejected_stock WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels])).rows[0].current_quantity),0);assert.equal(await stock(t),10);
});
await fixture('stale server snapshot reserves nothing',async t=>{
 await t.configure();await t.open();await t.activate();await assert.rejects(t.route(t.task,'prepare',{snapshot:{taskId:t.task,cycleLines:[{productId:t.productMap.bath_towels,quantity:1}]}}),/dotación cambió/);assert.equal((await t.db.query('SELECT count(*) n FROM laundry_cycle_bags')).rows[0].n,0);
});
console.log(`PASS ${checks} boundary scenarios: exact migration, synthetic data, no production writes.`);
}catch(e){console.error(e.message,e.where);process.exitCode=1;}
