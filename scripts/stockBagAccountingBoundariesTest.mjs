import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {stockBagDatabase} from './stockBagAccountingTestSupport.mjs';
let checks=0;
const check=label=>{checks++;console.log('PASS '+label);};
async function scenario(run){const t=await stockBagDatabase();try{await run(t);}finally{await t.db.close();}}
try{
 await scenario(async t=>{
  const {db,task,soap,sack}=t;
  const old=t.snapshot(2,1,1);delete old.amenities;
  await db.query("INSERT INTO laundry_bag_action_ledger(task_key,sede_id,action,bag_items,happened_at) VALUES($1,$2,'prepared',$3,$4::date)",[task,t.sede,old,t.before]);
  await t.prepare(task,t.snapshot(2,2,1));
  const plan=await t.preview(),row=id=>plan.rows.find(r=>r.productId===id);
  assert.equal(row(t.productMap.bath_towels).prepared,4,'unchanged older bag is not debited again');
  assert.equal(row(soap).prepared,2,'only the custom difference plus the new bag');
  assert.equal(row(sack).prepared,1,'unknown old sack content is not assumed zero');
  assert.equal(row(sack).untrackedBags,1);
  await t.activate(plan);await t.prepare(task,t.snapshot(2,2,1));
  assert.equal(Number((await t.level(sack)).current_quantity),9,'confirmed current snapshot is the future baseline');
  check('old bag differences and missing earlier amenities remain explicit unknowns');
 });
 await scenario(async t=>{
  const snapshot=t.snapshot();snapshot.stockConsumables=null;
  await t.prepare(t.task,snapshot);
  const plan=await t.preview(),row=plan.rows.find(r=>r.productId===t.soap);
  assert.equal(row.prepared,1);assert.equal(row.untrackedBags,1);
  await t.activate(plan);
  await assert.rejects(t.prepare(t.task,snapshot),/Falta el contenido/);
  check('incomplete legacy custom detail is visible; new preparations require complete contents');
 });
 await scenario(async t=>{
  await t.activate();
  await t.db.query("INSERT INTO laundry_delivery_tracking(share_link_id,task_id,status,delivered_at) VALUES($1,$2,'delivered',now())",[t.link,t.task]);
  await t.prepare();
  await assert.rejects(t.prepare(t.task,t.snapshot(1,1,1)),/ya se entregó/);
  assert.equal(Number((await t.level()).current_quantity),-3);
  await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[t.second]);
  await assert.rejects(t.prepare(t.second,t.snapshot(5,1,1,t.second)),/terminada o cancelada/);
  const bag=(await t.db.query('SELECT lines FROM stock_bag_consumption WHERE task_key=$1',[t.task])).rows[0];
  await assert.rejects(t.rpc('resolve_stock_bag_checked',{_task:t.task,_expected:bag.lines,_action:'unpack',_reason:'Desmontaje comprobado',_confirmed:true,_operation:randomUUID()}),/devolución/);
  await t.rpc('resolve_stock_bag_checked',{_task:t.task,_expected:bag.lines,_action:'return',_reason:'Devuelta y deshecha',_confirmed:true,_operation:randomUUID()});
  assert.equal(Number((await t.level()).current_quantity),-1);
  check('delivered or completed bags cannot be reduced or credited without a physical return');
 });
 await scenario(async t=>{
  await t.activate();
  const bag=(await t.db.query('SELECT * FROM stock_bag_consumption WHERE task_key=$1',[t.task])).rows[0];
  const cleaner=(await t.db.query('SELECT cleaner_id FROM laundry_route_workers WHERE id=$1',[t.worker])).rows[0].cleaner_id;
  const args={_task:t.task,_link:t.link,_worker:t.worker,_cleaner:cleaner,_name:'Persona de prueba',_snapshot:{...t.snapshot(),stockChangedAt:bag.changed_at.toISOString()}};
  await assert.rejects(t.rpc('deliver_stock_bag_checked',{...args,_worker:null}),/PIN/);
  await assert.rejects(t.rpc('deliver_stock_bag_checked',{...args,_snapshot:{...args._snapshot,stockChangedAt:'2020-01-01'}}),/bolsa cambió/);
  await t.rpc('deliver_stock_bag_checked',args);await t.rpc('deliver_stock_bag_checked',args);
  assert.equal(Number((await t.level()).current_quantity),-3,'delivery has no second central deduction');
  assert.equal((await t.db.query("SELECT count(*)::int n FROM laundry_route_worker_events WHERE action='deliver'")).rows[0].n,1);
  assert.equal((await t.db.query("SELECT has_function_privilege('anon','deliver_stock_bag_checked(uuid,uuid,uuid,uuid,text,jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
  await assert.rejects(t.prepare(t.task,t.snapshot(1,1,1)),/ya se entregó/);
  check('atomic delivery validates actor, exact bag version, semantic replay and service-only access');
 });
 await scenario(async t=>{
  const plan=await t.preview();await t.insertMovement(t.soap,20,21);
  await assert.rejects(t.activate(plan),/registros cambiaron/);
  assert.equal((await t.db.query('SELECT count(*)::int n FROM stock_bag_accounting_config')).rows[0].n,0);
  await t.activate();
  const op=randomUUID();await t.adjust(t.soap,'entrada',1,{operation:op});
  await assert.rejects(t.adjust(t.soap,'entrada',2,{operation:op}),/otros datos/);
  await assert.rejects(t.adjust(t.productMap.bath_towels,'entrada',0.5),/prendas enteras/);
  await assert.rejects(t.adjust(t.soap,'entrada',0.001),/dos decimales/);
  await assert.rejects(t.rpc('close_stock_bag_accounting_checked',{_sede:t.sede,_operation:randomUUID()}),/Cuenta cada producto/);
  check('stale openings roll back, UUID conflicts fail, quantities are checked and incomplete counts cannot close');
 });
 await scenario(async t=>{
  await t.activate();
  await t.mutate({action:'start'});await t.mutate({action:'add',material:'bath_towels',quantity:2});
  let state=await t.state();await t.mutate({action:'confirm',expectedRevision:state.receipt.revision});
  assert.equal(Number((await t.level()).current_quantity),-1,'receipt adds into an explicitly partial negative');
  state=await t.state();await t.mutate({action:'set',material:'bath_towels',quantity:1,expectedRevision:state.receipt.revision});
  state=await t.state();await t.mutate({action:'confirm',expectedRevision:state.receipt.revision});
  assert.equal(Number((await t.level()).current_quantity),-2,'receipt correction posts its signed difference');
  await t.adjust(t.productMap.bath_towels,'ajuste',10,{verified:true});
  state=await t.state();await t.mutate({action:'set',material:'bath_towels',quantity:3,expectedRevision:state.receipt.revision});
  state=await t.state();await t.mutate({action:'confirm',expectedRevision:state.receipt.revision});
  assert.equal(Number((await t.level()).current_quantity),10,'a receipt already included in a physical count is not posted twice');
  const version=(await t.db.query('SELECT snapshot FROM laundry_receipt_versions ORDER BY created_at DESC,version DESC LIMIT 1')).rows[0];
  assert.equal(version.snapshot.stock_posting_exclusions.length,1);
  const before=await t.state({date:t.before});assert.equal(before.receipt,null);
  await t.mutate({action:'start'},{date:t.before});await t.mutate({action:'add',material:'bath_towels',quantity:4},{date:t.before});
  const previous=await t.state({date:t.before});await t.mutate({action:'confirm',expectedRevision:previous.receipt.revision},{date:t.before});
  assert.equal(Number((await t.level()).current_quantity),10,'pre-opening receipt is recorded without crediting excluded old stock');
  check('receipt deltas, prior dates and counted inclusions preserve stock and receipt history');
 });
 await scenario(async t=>{
  await t.configure();await t.open();await t.rpc('activate_laundry_cycle_checked',{_sede:t.sede});
  await t.route(t.task,'prepare');await t.route(t.task,'deliver');
  await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[t.task]);
  assert.equal(Number((await t.level()).current_quantity),8);
  assert.equal((await t.db.query('SELECT count(*)::int n FROM stock_bag_consumption')).rows[0].n,0);
  check('new SQL leaves the previously counted full physical circuit operating independently');
 });
 console.log(`PASS ${checks} bag accounting boundary groups, exact SQL, synthetic data, no production access.`);
}catch(error){console.error(error.message,error.where??'');process.exitCode=1;}
