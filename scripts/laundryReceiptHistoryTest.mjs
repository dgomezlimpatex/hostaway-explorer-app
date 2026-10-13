import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { receiptTestDatabase } from './laundryReceiptTestSupport.mjs';
import { loadReceiptEdge } from './laundryReceiptEdgeTestSupport.mjs';

const t = await receiptTestDatabase();
const yesterday = (await t.db.query("SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date-1)::text AS d")).rows[0].d;
const tomorrow = (await t.db.query("SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date+1)::text AS d")).rows[0].d;
const adminRead = (date = yesterday) => t.rpc('read_laundry_receipt_admin', { _warehouse:t.warehouse,_actor:t.admin,_date:date });
const adminMutate = (payload, options = {}) => t.rpc('mutate_laundry_receipt_admin', { _warehouse:t.warehouse,_actor:options.actor??t.admin,_date:options.date??yesterday,_op_id:options.id??randomUUID(),_payload:payload });
const stock = () => t.db.query('SELECT current_quantity::int AS n FROM stock_levels WHERE product_id=$1',[t.productMap.suite_sheets]).then(r=>r.rows[0]?.n??0);
const confirm = () => adminRead().then(s=>adminMutate({action:'confirm',expectedRevision:s.receipt.revision}));
try {
 await t.mutate({action:'start'},{date:yesterday});
 await adminMutate({action:'start'});
 assert.equal((await t.db.query('SELECT count(*)::int AS n FROM laundry_receipts')).rows[0].n,1,'Same warehouse/day is shared');
 const id=randomUUID();
 await adminMutate({action:'add',material:'suite_sheets',quantity:20},{id});
 await adminMutate({action:'add',material:'suite_sheets',quantity:20},{id});
 await t.mutate({action:'add',material:'suite_sheets',quantity:5},{date:yesterday});
 await adminMutate({action:'add_discard',material:'suite_sheets',quantity:3});
 let s=await adminRead();
 assert.equal(s.receipt.counts.suite_sheets,25);
 assert.equal(s.receipt.discarded_counts.suite_sheets,3);
 assert.equal(await stock(),0,'A historical draft does not move stock');
 await assert.rejects(()=>adminMutate({action:'set',material:'suite_sheets',quantity:30,expectedRevision:0}),/recuento ha cambiado/);
 const first=await confirm();
 assert.equal(await stock(),25);
 assert.equal((await confirm()).unchanged,true);
 assert.equal(await stock(),25);
 s=await adminRead();
 assert.equal(s.versions[0].snapshot.receipt_date,yesterday);
 assert.equal(s.versions[0].admin_user_id,t.admin);
 assert.equal(s.versions[0].worker_id,null);
 assert.equal(s.versions[0].snapshot.worker_name,'Administración de prueba');
 assert(s.operations.some(o=>o.admin_user_id===t.admin&&o.worker_name==='Administración de prueba'));
 assert(s.operations.some(o=>o.worker_name==='Empleado A'));
 const originalSnapshot=s.versions[0].snapshot;
 await adminMutate({action:'set',material:'suite_sheets',quantity:18,expectedRevision:s.receipt.revision});
 await confirm();
 assert.equal(await stock(),18,'A historical correction moves the difference only');
 const historical=(await t.db.query('SELECT snapshot FROM laundry_receipt_versions WHERE id=$1',[first.versionId])).rows[0].snapshot;
 assert.deepEqual(historical,originalSnapshot);
 await assert.rejects(()=>adminMutate({action:'start'},{date:tomorrow}),/Fecha inválida/);
 await assert.rejects(()=>t.mutate({action:'start'},{date:tomorrow}),/Fecha inválida/);
 await assert.rejects(()=>adminRead(tomorrow),/Fecha inválida/);
 await assert.rejects(()=>adminMutate({action:'start'},{actor:randomUUID()}),/acceso administrativo/);
 await t.db.query('UPDATE user_sede_access SET can_access=false WHERE user_id=$1',[t.admin]);
 await assert.rejects(()=>adminRead(),/acceso administrativo/);
 await t.db.query('UPDATE user_sede_access SET can_access=true WHERE user_id=$1',[t.admin]);
 await t.db.query("UPDATE user_roles SET role='cleaner' WHERE user_id=$1",[t.admin]);
 await assert.rejects(()=>adminMutate({action:'start'}),/acceso administrativo/);
 await t.db.query("UPDATE user_roles SET role='admin' WHERE user_id=$1",[t.admin]);
 await assert.rejects(()=>t.mutate({action:'add',material:'suite_sheets',quantity:20},{date:yesterday,id}),/Identificador de operación/);
 // Explicit new functions are private; an authenticated browser cannot spoof _actor.
 const rights=(await t.db.query("SELECT has_function_privilege('authenticated','public.mutate_laundry_receipt_admin(uuid,uuid,date,uuid,jsonb)','EXECUTE') AS admin, has_function_privilege('anon','public.apply_laundry_receipt_operation(uuid,uuid,uuid,text,date,uuid,jsonb)','EXECUTE') AS core")).rows[0];
 assert.deepEqual(rights,{admin:false,core:false});

 const {request}=await loadReceiptEdge(t);
 const readBody={action:'admin_receipt_read',warehouseId:t.warehouse,date:yesterday};
 assert.equal((await request(readBody)).status,401);
 assert.equal((await request(readBody,'Bearer fixture-service-role')).status,403,'Admin actions require a real auditable user');
 assert.equal((await request(readBody,'Bearer fixture-admin-jwt')).data.date,yesterday);
 const added=await request({action:'admin_receipt_mutate',warehouseId:t.warehouse,date:yesterday,operationId:randomUUID(),workerId:randomUUID(),actorId:randomUUID(),payload:{action:'add',material:'suite_sheets',quantity:1}},'Bearer fixture-admin-jwt');
 assert.equal(added.status,200);
 assert.equal((await adminRead()).operations[0].admin_user_id,t.admin,'Request body cannot impersonate the actor');
 const wrongWarehouse=randomUUID();
 assert.equal((await request({...readBody,warehouseId:wrongWarehouse},'Bearer fixture-admin-jwt')).status,404);
 const outSede=randomUUID(),outWarehouse=randomUUID();
 await t.db.query('INSERT INTO sedes VALUES ($1)',[outSede]);
 await t.db.query("INSERT INTO stock_warehouses(id,sede_id,name) VALUES($1,$2,'Otra sede')",[outWarehouse,outSede]);
 assert.equal((await request({...readBody,warehouseId:outWarehouse},'Bearer fixture-admin-jwt')).status,403);
 assert.equal((await request({...readBody,date:tomorrow},'Bearer fixture-admin-jwt')).status,400);
 assert.equal((await request({...readBody,date:'2026-02-30'},'Bearer fixture-admin-jwt')).status,400);
 await t.db.query('UPDATE laundry_receipt_links SET is_active=false WHERE id=$1',[t.config.id]);
 assert.equal((await request(readBody,'Bearer fixture-admin-jwt')).status,200,'Admin can inspect a disabled public link');
 await assert.rejects(()=>t.state({date:yesterday}),/Sesión caducada/);

 const bundle=await build({entryPoints:['supabase/functions/_shared/laundryReceiptDomain.ts'],bundle:true,write:false,platform:'node',format:'esm'});
 const domain=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 assert.equal(domain.isReceiptDate(yesterday,t.date),true);
 for(const invalid of ['',tomorrow,'2026-02-30','0000-01-01','2026-1-01'])assert.equal(domain.isReceiptDate(invalid,t.date),false);

 const legacy=await receiptTestDatabase({history:false});
 try {
  await legacy.mutate({action:'start'});
  await legacy.mutate({action:'add',material:'bath_towels',quantity:4});
  await legacy.mutate({action:'confirm',expectedRevision:1});
  const snapshot=(await legacy.state()).versions[0].snapshot;
  await legacy.db.exec(await readFile(new URL('../supabase/migrations/20261013140000_laundry_receipt_history_admin.sql',import.meta.url),'utf8'));
  assert.deepEqual((await legacy.state()).versions[0].snapshot,snapshot);
  assert.equal((await legacy.mutate({action:'confirm',expectedRevision:1})).unchanged,true);
 } finally {await legacy.db.close();}
 console.log('Historical receipts: worker/admin shared dates, immutable history, admin audit, retry/actor isolation, delta stock, discards, date validation, roles/site scope, private RPCs, disabled links and legacy upgrade verified locally.');
} finally {await t.db.close();}
