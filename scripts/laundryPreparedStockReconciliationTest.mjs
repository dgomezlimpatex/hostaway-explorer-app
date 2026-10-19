import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {stockBagDatabase} from './stockBagAccountingTestSupport.mjs';
const migration=await readFile('supabase/migrations/20261019075942_laundry_prepared_stock_reconciliation.sql','utf8');
async function fixture(run){
 const t=await stockBagDatabase();
 try {
  await t.db.exec(await readFile('supabase/migrations/20261015173000_laundry_replenishment_start.sql','utf8'));
  await t.activate();await t.db.query('UPDATE stock_bag_accounting_config SET active=false');
  await t.configure('all',false,'central','central');await t.open();await t.rpc('activate_laundry_cycle_checked',{_sede:t.sede});
  await t.db.exec('CREATE SCHEMA cron;CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$SELECT 1::bigint$$;');
  await t.db.exec(await readFile('supabase/migrations/20261016132409_laundry_scheduled_route_completion.sql','utf8'));
  await t.db.exec(await readFile('supabase/migrations/20261016160304_laundry_scheduler_server_context.sql','utf8'));
  await t.db.exec(migration);
  t.newTask=async()=>{const id=randomUUID();await t.db.query("INSERT INTO tasks(id,propiedad_id,sede_id,date,type,status) VALUES($1,$2,$3,$4,'limpieza-turistica','pending')",[id,t.property,t.sede,t.date]);await t.db.query('UPDATE laundry_share_links SET snapshot_task_ids=array_append(snapshot_task_ids,$1),filters=$2 WHERE id=$3',[id,{deliveryDate:t.date,routeDates:[t.date]},t.link]);return id;};
  t.qty=async()=>Number((await t.db.query('SELECT current_quantity FROM stock_levels WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels])).rows[0]?.current_quantity??0);
  t.movements=async()=>(await t.db.query("SELECT * FROM stock_movements WHERE reason LIKE 'Ajuste de ropa disponible confirmado%' ORDER BY created_at")).rows;
  t.confirm=id=>t.route(id,'prepare',{snapshot:{textiles:{towelsLarge:2},amenities:{trashSacks100L:1},stockConsumables:[{productId:t.soap,quantity:1}]}});
  await run(t);
 }finally{await t.db.close();}
}
await fixture(async t=>{
 const first=await t.newTask(),second=await t.newTask();
 await t.db.query('UPDATE stock_levels SET current_quantity=3 WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels]);
 await t.confirm(first);assert.equal((await t.movements()).length,0);
 await t.confirm(second);assert.equal(await t.qty(),4);
 const moves=await t.movements();assert.equal(moves.length,1);assert.equal(Number(moves[0].quantity),1);assert.equal(moves[0].movement_type,'ajuste');assert.equal(moves[0].task_id,second);
 assert.equal(Number(await t.rpc('laundry_cycle_reserved',{_warehouse:t.central,_product:t.productMap.bath_towels})),4);
 await t.confirm(second);assert.equal((await t.movements()).length,1);
 const jobs=(await t.db.query('SELECT due_at FROM laundry_scheduled_completions WHERE task_key=$1',[second])).rows;
 const at=new Date(jobs[0].due_at).toISOString();
 assert.equal((await t.rpc('run_scheduled_laundry_completions',{_at:at})).completed,2);
 assert.equal(await t.qty(),0);assert.equal((await t.rpc('run_scheduled_laundry_completions',{_at:at})).completed,0);
 assert.equal((await t.movements()).length,1);
 console.log('PASS shortage-only adjustment, other bag reserved, replay safe, both scheduled deliveries succeed exactly once');
});
await fixture(async t=>{
 const id=await t.newTask();
 await t.db.query('DELETE FROM stock_levels WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels]);
 await t.confirm(id);assert.equal(await t.qty(),2);assert.equal(Number((await t.movements())[0].quantity),2);
 console.log('PASS missing balance created with explicit adjustment and bag confirmation');
});
await fixture(async t=>{
 const id=await t.newTask();await t.db.query('UPDATE stock_levels SET current_quantity=0 WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels]);
 await assert.rejects(t.route(id,'prepare',{worker:randomUUID()}),/PIN/);
 await assert.rejects(t.route(id,'prepare',{snapshot:{cycleLines:[]}}),/dotación cambió/);
 assert.equal(await t.qty(),0);assert.equal((await t.movements()).length,0);
 // A downstream accounting failure must roll back the proposed textile adjustment.
 await t.db.query('UPDATE stock_levels SET current_quantity=0 WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.soap]);
 await assert.rejects(t.confirm(id));assert.equal(await t.qty(),0);assert.equal((await t.movements()).length,0);
 console.log('PASS invalid worker, stale snapshot and downstream shortage preserve stock atomically');
});
