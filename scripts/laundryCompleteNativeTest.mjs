import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {completeCycleDatabase} from './laundryCompleteCycleTestSupport.mjs';
import {execFileSync,spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Only a disposable native server at the explicitly fixed loopback port. Never
// uses Supabase credentials, DATABASE_URL, app client or production test commands.
const root=process.env.LAUNDRY_NATIVE_ROOT;
if(!root)throw new Error('LAUNDRY_NATIVE_ROOT must point to the disposable test runtime');
const exe=join(root,'pgsql/bin/psql.exe');
const args=['-h','127.0.0.1','-p','55437','-U','fixture','-d','postgres','-X','-v','ON_ERROR_STOP=1','-q','-t','-A'];
const run=sql=>execFileSync(exe,[...args,'-c',sql],{encoding:'utf8',windowsHide:true,maxBuffer:2e6}).trim();
const literal=v=>v==null?'NULL':typeof v==='number'||typeof v==='boolean'?String(v):"'"+(Array.isArray(v)&&v.every(x=>typeof x==='string')?'{'+v.join(',')+'}':typeof v==='object'?JSON.stringify(v):String(v)).replaceAll("'","''")+"'";
const statements=[];const originalExec=PGlite.prototype.exec,originalQuery=PGlite.prototype.query;
PGlite.prototype.exec=async function(sql,...rest){statements.push(sql+'\n;');return originalExec.call(this,sql,...rest);};
PGlite.prototype.query=async function(sql,values=[],...rest){
 statements.push(sql.replace(/\$(\d+)/g,(_,n)=>literal(values[Number(n)-1]))+';');
 const result=await originalQuery.call(this,sql,values,...rest);
 if(sql.includes('public.configure_laundry_receipt(')) {
  const cfg=result.rows[0].result;
  statements.push(`UPDATE laundry_receipt_links SET token=${literal(cfg.token)} WHERE warehouse_id=${literal(cfg.warehouse_id)};`);
 }
 return result;
};
let t;
const database='laundry_fixture_'+Date.now();
try {
 assert.equal(run('SHOW data_directory').replaceAll('\\','/').toLowerCase(),join(root,'data').replaceAll('\\','/').toLowerCase(),'Only the disposable runtime may be used');
 run('CREATE DATABASE '+database); args[7]=database;
 t=await completeCycleDatabase();await t.configure();await t.open();await t.activate();
 const roleSetup="DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;";
 const file=join(root,'fixture.sql');await writeFile(file,roleSetup+'\n'+statements.join('\n').replace(/CREATE ROLE (anon|authenticated|service_role)( BYPASSRLS)?;/g,''),'utf8');
 execFileSync(exe,[...args,'-f',file],{encoding:'utf8',windowsHide:true,maxBuffer:2e6});
 const {task,second,link,worker,central,productMap,admin}=t;
 const cleaner=run(`SELECT cleaner_id FROM laundry_route_workers WHERE id=${literal(worker)}`);
 const rpc=(id,action)=>`SELECT public.laundry_cycle_route(${literal(id)},${literal(link)},${literal(action)},${literal(worker)},${literal(cleaner)},'Prueba nativa',(SELECT jsonb_build_object('taskId',t.id,'propertyId',t.propiedad_id,'date',t.date,'cycleGeneration',coalesce(b.generation,0),'cycleLines',public.laundry_cycle_lines(t.id),'dirtyLines',public.laundry_cycle_dirty_lines(t.propiedad_id,t.sede_id)) FROM tasks t LEFT JOIN laundry_cycle_bags b ON b.task_key=t.id WHERE t.id=${literal(id)}),NULL);`;
 const concurrent=sql=>new Promise((resolve,reject)=>{let out='',err='';const child=spawn(exe,[...args,'-c',sql],{windowsHide:true});child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(new Error(err)));});
 await Promise.all([concurrent(rpc(task,'prepare')),concurrent(rpc(task,'prepare'))]);
 assert.equal(Number(run(`SELECT laundry_cycle_reserved(${literal(central)},${literal(productMap.bath_towels)})`)),2);
 await Promise.all([concurrent(rpc(task,'deliver')),concurrent(rpc(task,'deliver'))]);
 assert.equal(Number(run(`SELECT current_quantity FROM stock_levels WHERE warehouse_id=${literal(central)} AND product_id=${literal(productMap.bath_towels)}`)),8);
 assert.equal(run(`SELECT count(*) FROM laundry_cycle_events WHERE task_key=${literal(task)} AND kind='deliver'`),'1');
 console.log('PASS native PostgreSQL: concurrent preparation and delivery, two independent connections, one physical event');
 const completion=`UPDATE tasks SET status='completed' WHERE id=${literal(task)};`;
 await Promise.all([concurrent(completion),concurrent(completion)]);
 assert.equal(run(`SELECT count(*) FROM laundry_cycle_events WHERE task_key=${literal(task)} AND kind='cleaning'`),'1');
 run(rpc(second,'prepare'));run(rpc(second,'deliver'));run(rpc(second,'collect'));
 console.log('PASS native PostgreSQL: concurrent completion and next pickup conserve task identity');
 const receipt=(payload,op)=>`SELECT mutate_laundry_receipt(${literal(t.config.token)},${literal(t.sessionHash)},${literal(t.date)},${literal(op)},${literal(payload)}::jsonb);`;
 const {randomUUID}=await import('node:crypto');run(receipt({action:'start'},randomUUID()));run(receipt({action:'add',material:'bath_towels',quantity:1},randomUUID()));
 const revision=Number(run(`SELECT revision FROM laundry_receipts WHERE receipt_date=${literal(t.date)}`));const confirmation=randomUUID();
 await Promise.all([concurrent(receipt({action:'confirm',expectedRevision:revision},confirmation)),concurrent(receipt({action:'confirm',expectedRevision:revision},confirmation))]);
 assert.equal(Number(run(`SELECT quantity FROM laundry_cycle_pool WHERE product_id=${literal(productMap.bath_towels)} AND sede_id=${literal(t.sede)}`)),3);
 console.log('PASS native PostgreSQL: concurrent receipt confirmation closes pending linen and credits clean once');
 // Race receipt (link -> configuration -> stock) against cleaner completion
 // (task -> configuration -> stock), proving neither partial write nor deadlock.
 run(receipt({action:'add',material:'bath_towels',quantity:1},randomUUID()));
 const rev2=Number(run(`SELECT revision FROM laundry_receipts WHERE receipt_date=${literal(t.date)}`));
 await Promise.all([concurrent(receipt({action:'confirm',expectedRevision:rev2},randomUUID())),concurrent(`UPDATE tasks SET status='completed' WHERE id=${literal(second)};`)]);
 assert.equal(run(`SELECT count(*) FROM laundry_cycle_issues WHERE code='cleaning_failed'`),'0');
 console.log('PASS native PostgreSQL: receipt/cleaner race completes without deadlock or partial failure');
 const denied=await concurrent(`SET ROLE anon;${rpc(task,'deliver')}`).then(()=>false,e=>e.message.includes('permission denied'));
 assert.equal(denied,true);assert.equal(run(`SELECT has_table_privilege('authenticated','laundry_cycle_bags','INSERT')`),'f');
 console.log('PASS native PostgreSQL: actual function grants and direct table-write protection');
} catch(e){console.error(e.message);process.exitCode=1;}finally{PGlite.prototype.exec=originalExec;PGlite.prototype.query=originalQuery;if(t)await t.db.close();args[7]='postgres';run('DROP DATABASE IF EXISTS '+database+' WITH (FORCE)');}
