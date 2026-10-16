import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {stockBagDatabase} from './stockBagAccountingTestSupport.mjs';

const sql=await readFile(new URL('../supabase/migrations/20261016132409_laundry_scheduled_route_completion.sql',import.meta.url),'utf8');
const replenishment=await readFile(new URL('../supabase/migrations/20261015173000_laundry_replenishment_start.sql',import.meta.url),'utf8');
let checks=0;
async function fixture(name,run,mode='cycle',beforeMigration) {
 const t=await stockBagDatabase();
 try {
  await t.db.exec(replenishment);
  if(mode!=='tracking')await t.activate();
  if(mode==='cycle'){
   await t.db.query('UPDATE stock_bag_accounting_config SET active=false');
   await t.configure('all',false,'central','central');await t.open();
   await t.rpc('activate_laundry_cycle_checked',{_sede:t.sede});
  }
  // Only cron infrastructure is stubbed. Every accounting function/table is real SQL.
  await t.db.exec(`CREATE SCHEMA cron;CREATE TABLE cron.job(jobname text PRIMARY KEY,schedule text,command text);
   CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO cron.job VALUES($1,$2,$3) RETURNING 1::bigint $$;`);
  if(beforeMigration)await beforeMigration(t);
  await t.db.exec(sql);
  const id=randomUUID();
  await t.db.query("INSERT INTO tasks(id,propiedad_id,sede_id,date,type,status) VALUES($1,$2,$3,$4,'limpieza-turistica','pending')",[id,t.property,t.sede,t.date]);
  await t.db.query('UPDATE laundry_share_links SET snapshot_task_ids=array_append(snapshot_task_ids,$1),filters=$2 WHERE id=$3',[id,{deliveryDate:t.date,routeDates:[t.date],nextRouteDates:[]},t.link]);
  t.target=id;t.mode=mode;
  t.confirm=()=> mode==='cycle'?t.route(id,'prepare',{snapshot:{textiles:{towelsLarge:2},amenities:{trashSacks100L:1},stockConsumables:[{productId:t.soap,quantity:1}]}})
   :t.prepare(id,{...t.snapshot(2,1,1,id),taskId:id});
  t.job=async()=>(await t.db.query('SELECT * FROM laundry_scheduled_completions WHERE task_key=$1 ORDER BY created_at DESC',[id])).rows[0];
  t.run=at=>t.rpc('run_scheduled_laundry_completions',{_at:at});
  t.qty=async warehouse=>Number((await t.db.query('SELECT current_quantity FROM stock_levels WHERE warehouse_id=$1 AND product_id=$2',[warehouse,t.productMap.bath_towels])).rows[0].current_quantity);
  t.dirty=async(quantity=2)=>{
   await t.db.query('INSERT INTO laundry_cycle_dirty(property_id,product_id,sede_id,warehouse_id,quantity) VALUES($1,$2,$3,$4,$5) ON CONFLICT(property_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity',[t.property,t.productMap.bath_towels,t.sede,t.building,quantity]);
   await t.db.query('INSERT INTO laundry_dirty_stock(warehouse_id,product_id,current_quantity) VALUES($1,$2,$3) ON CONFLICT(warehouse_id,product_id) DO UPDATE SET current_quantity=EXCLUDED.current_quantity',[t.building,t.productMap.bath_towels,quantity]);
  };
  await run(t);console.log('PASS '+name);checks++;
 }finally{await t.db.close();}
}
await fixture('17:00 Madrid: reserve first, then atomic delivery/collection, replay does nothing',async t=>{
 const central=await t.qty(t.central),building=await t.qty(t.building);
 await t.dirty();await t.confirm();const j=await t.job();
 assert.equal(await t.qty(t.central),central);assert.equal(await t.qty(t.building),building);
 assert.deepEqual(await t.run(new Date(new Date(j.due_at).getTime()-1).toISOString()),{completed:0,blocked:0});
 assert.equal((await t.job()).status,'pending');
 assert.deepEqual(await t.run(j.due_at),{completed:1,blocked:0});
 assert.equal(await t.qty(t.central),central-2);assert.equal(await t.qty(t.building),building+2);
 assert.equal(Number((await t.db.query('SELECT quantity FROM laundry_cycle_collected WHERE sede_id=$1 AND product_id=$2',[t.sede,t.productMap.bath_towels])).rows[0].quantity),2);
 const tracking=(await t.db.query('SELECT * FROM laundry_delivery_tracking WHERE task_id=$1',[t.target])).rows[0];
 assert.equal(tracking.status,'delivered');assert.equal(tracking.collection_status,'collected');assert.match(tracking.delivered_by_name,/Automático/);
 assert.deepEqual(await t.run(j.due_at),{completed:0,blocked:0});assert.equal(await t.qty(t.central),central-2);
 await t.db.query('SELECT public.enqueue_laundry_completion($1)',[t.target]);assert.equal((await t.job()).status,'completed');
});
await fixture('next-route bags use Sunday route date, not Friday service/preparation date',async t=>{
 const next=(await t.db.query("SELECT ($1::date+2)::text d",[t.date])).rows[0].d;
 await t.db.query('UPDATE laundry_share_links SET filters=$1 WHERE id=$2',[{deliveryDate:t.date,routeDates:[],nextDeliveryDate:next,nextRouteDates:[t.date]},t.link]);
 await t.confirm();const j=await t.job();
 assert.equal(new Date(j.delivery_date).toISOString().slice(0,10),next);assert.equal(new Date(j.service_date).toISOString().slice(0,10),t.date);
 const before=(await t.db.query("SELECT ($1::date+time '17:00') AT TIME ZONE 'Europe/Madrid' at",[t.date])).rows[0].at;
 assert.equal((await t.run(before)).completed,0);assert.equal((await t.run(j.due_at)).completed,1);
});
await fixture('summer and winter both execute at 17:00 Europe/Madrid',async t=>{
 for(const [date,hour] of [['2026-10-18',15],['2026-10-25',16]]){
  await t.db.query('UPDATE laundry_share_links SET filters=$1 WHERE id=$2',[{deliveryDate:date,routeDates:[t.date]},t.link]);
  await t.confirm();const j=await t.job();assert.equal(new Date(j.due_at).getUTCHours(),hour);
 }
});
await fixture('moved service date blocks without moving stock',async t=>{
 await t.confirm();const j=await t.job();const before=await t.qty(t.central);
 await t.db.query("UPDATE tasks SET date=date+1 WHERE id=$1",[t.target]);
 assert.equal((await t.run(j.due_at)).blocked,1);assert.equal(await t.qty(t.central),before);
 assert.equal((await t.job()).status,'blocked');assert.equal((await t.run(j.due_at)).blocked,0);
 assert.equal((await t.db.query("SELECT count(*)::int n FROM laundry_cycle_issues WHERE code='scheduled_route_failed'")).rows[0].n,1);
});
await fixture('cancelled task blocks without recording an automatic delivery',async t=>{
 await t.confirm();const j=await t.job(),before=await t.qty(t.central);
 await t.db.query("UPDATE tasks SET status='cancelled' WHERE id=$1",[t.target]);
 assert.equal((await t.run(j.due_at)).blocked,1);assert.equal(await t.qty(t.central),before);
});
await fixture('changed textile requirements block the old prepared bag',async t=>{
 await t.confirm();const j=await t.job(),before=await t.qty(t.central);
 await t.db.query('UPDATE properties SET numero_toallas_grandes=3 WHERE id=$1',[t.property]);
 assert.equal((await t.run(j.due_at)).blocked,1);assert.equal(await t.qty(t.central),before);
});
await fixture('a prior manual delivery is preserved and never discounted twice',async t=>{
 await t.confirm();const j=await t.job();await t.route(t.target,'deliver');const before=await t.qty(t.central);
 assert.equal((await t.run(j.due_at)).completed,1);assert.equal(await t.qty(t.central),before);
 assert.equal((await t.db.query("SELECT count(*)::int n FROM laundry_cycle_events WHERE task_key=$1 AND kind='deliver'",[t.target])).rows[0].n,1);
});
await fixture('direct property has no invented warehouse; zero dirty does not create dirty stock',async t=>{
 await t.db.query('UPDATE tasks SET propiedad_id=$1 WHERE id=$2',[t.solo,t.target]);
 await t.confirm();const j=await t.job();assert.equal((await t.run(j.due_at)).completed,1);
 assert.equal(await t.qty(t.central),8);assert.equal(await t.qty(t.building),4);
 assert.equal((await t.db.query('SELECT destination_id FROM laundry_cycle_bags WHERE task_key=$1',[t.target])).rows[0].destination_id,null);
 assert.equal(Number((await t.db.query('SELECT coalesce(sum(quantity),0) n FROM laundry_cycle_collected')).rows[0].n),0);
});
await fixture('collection failure rolls back the entire delivery, preserving reservation',async t=>{
 await t.dirty();await t.confirm();const j=await t.job();const before=await t.qty(t.central);
 await t.db.query('UPDATE laundry_dirty_stock SET current_quantity=0 WHERE warehouse_id=$1',[t.building]);
 assert.equal((await t.run(j.due_at)).blocked,1);assert.equal(await t.qty(t.central),before);
 assert.equal((await t.db.query('SELECT state FROM laundry_cycle_bags WHERE task_key=$1',[t.target])).rows[0].state,'prepared');
 assert.equal((await t.db.query("SELECT count(*)::int n FROM laundry_cycle_events WHERE task_key=$1 AND kind='deliver'",[t.target])).rows[0].n,0);
});
await fixture('issue removes scheduled movement; fresh confirmation reschedules safely',async t=>{
 await t.confirm();let j=await t.job();await t.route(t.target,'issue',{issue:'Falta material'});
 assert.equal((await t.job()).status,'cancelled');assert.equal((await t.run(j.due_at)).completed,0);
 await t.confirm();j=await t.job();assert.equal(j.status,'pending');assert.equal((await t.run(j.due_at)).completed,1);
});
await fixture('partial stock is never discounted a second time; no invented dirty quantities',async t=>{
 await t.confirm();const j=await t.job(),before=await t.qty(t.central);
 assert.equal(j.mode,'partial');assert.equal((await t.run(j.due_at)).completed,1);assert.equal(await t.qty(t.central),before);
 assert.equal((await t.db.query('SELECT count(*)::int n FROM laundry_cycle_events WHERE task_key=$1',[t.target])).rows[0].n,0);
},'partial');
await fixture('tracking-only routes are registered without inventory movement',async t=>{
 await t.confirm();const j=await t.job(),before=await t.qty(t.central);
 assert.equal(j.mode,'tracking');assert.equal((await t.run(j.due_at)).completed,1);assert.equal(await t.qty(t.central),before);
},'tracking');
await fixture('new scheduler and queue cannot be called/read by client roles',async t=>{
 for(const role of ['anon','authenticated','service_role']){
  const rows=(await t.db.query("SELECT has_function_privilege($1,'public.run_scheduled_laundry_completions(timestamptz)','EXECUTE') callable,has_table_privilege($1,'public.laundry_scheduled_completions','SELECT') readable",[role])).rows;
  assert.equal(rows[0].callable,false);assert.equal(rows[0].readable,false);
 }
 const job=(await t.db.query('SELECT * FROM cron.job')).rows[0];assert.equal(job.schedule,'* * * * *');assert.equal(job.command,'SELECT public.run_scheduled_laundry_completions();');
});
await fixture('migration adopts prepared bags for today, without requiring a second click',async t=>{
 assert.equal((await t.db.query('SELECT count(*)::int n FROM laundry_scheduled_completions')).rows[0].n,2);
},'tracking',async t=>{
 await t.db.query('UPDATE laundry_share_links SET filters=$1 WHERE id=$2',[{deliveryDate:t.date,routeDates:[t.date]},t.link]);
});
await fixture('migration does not complete historical routes',async t=>{
 assert.equal((await t.db.query('SELECT count(*)::int n FROM laundry_scheduled_completions')).rows[0].n,0);
},'tracking',async t=>{
 const old=(await t.db.query("SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date-1)::text d")).rows[0].d;
 await t.db.query('UPDATE laundry_share_links SET filters=$1 WHERE id=$2',[{deliveryDate:old,routeDates:[t.date]},t.link]);
});
console.log(`PASS ${checks} scheduled completion scenarios; exact migration in isolated PGlite, no production connection`);
