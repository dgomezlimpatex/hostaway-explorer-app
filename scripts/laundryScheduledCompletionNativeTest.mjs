import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {stockBagDatabase} from './stockBagAccountingTestSupport.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const root=process.env.LAUNDRY_NATIVE_ROOT;
if(!root)throw new Error('LAUNDRY_NATIVE_ROOT must identify the disposable local PostgreSQL runtime');
const exe=join(root,'pgsql/bin/psql.exe');
const args=['-h','127.0.0.1','-p','55437','-U','fixture','-d','postgres','-X','-v','ON_ERROR_STOP=1','-q','-t','-A'];
const run=sql=>execFileSync(exe,[...args,'-c',sql],{encoding:'utf8',windowsHide:true,maxBuffer:4e6}).trim();
const literal=v=>v==null?'NULL':typeof v==='number'||typeof v==='boolean'?String(v):"'"+(Array.isArray(v)&&v.every(x=>typeof x==='string')?'{'+v.join(',')+'}':typeof v==='object'?JSON.stringify(v):String(v)).replaceAll("'","''")+"'";
const statements=[],originalExec=PGlite.prototype.exec,originalQuery=PGlite.prototype.query;
PGlite.prototype.exec=async function(sql,...rest){statements.push(sql+'\n;');return originalExec.call(this,sql,...rest);};
PGlite.prototype.query=async function(sql,values=[],...rest){
 const recorded=sql.includes('public.activate_stock_bag_accounting_checked(')
  ? `SELECT public.activate_stock_bag_accounting_checked(${literal(values[0])},${literal(values[1])},${literal(values[2])},(public.preview_stock_bag_accounting_checked(${literal(values[0])},${literal(values[1])},${literal(values[2])})->>'fingerprint'),${literal(values[4])});`
  :sql.replace(/\$(\d+)/g,(_,n)=>literal(values[Number(n)-1]))+';';
 statements.push(recorded);
 const result=await originalQuery.call(this,sql,values,...rest);
 if(sql.includes('public.configure_laundry_receipt(')){
  const cfg=result.rows[0].result;statements.push(`UPDATE laundry_receipt_links SET token=${literal(cfg.token)} WHERE warehouse_id=${literal(cfg.warehouse_id)};`);
 }
 return result;
};
let t,created=false;const database='laundry_scheduled_fixture_'+Date.now();
try{
 assert.equal(run('SHOW data_directory').replaceAll('\\','/').toLowerCase(),join(root,'data').replaceAll('\\','/').toLowerCase());
 t=await stockBagDatabase();
 await t.db.exec(await readFile('supabase/migrations/20261015173000_laundry_replenishment_start.sql','utf8'));
 await t.activate();await t.db.query('UPDATE stock_bag_accounting_config SET active=false');
 await t.configure('all',false,'central','central');await t.open();await t.rpc('activate_laundry_cycle_checked',{_sede:t.sede});
 await t.db.exec(`CREATE SCHEMA cron;CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;`);
 await t.db.exec(await readFile('supabase/migrations/20261016132409_laundry_scheduled_route_completion.sql','utf8'));
 const id=randomUUID();
 await t.db.query("INSERT INTO tasks(id,propiedad_id,sede_id,date,type,status) VALUES($1,$2,$3,$4,'limpieza-turistica','pending')",[id,t.property,t.sede,t.date]);
 await t.db.query('UPDATE laundry_share_links SET snapshot_task_ids=array_append(snapshot_task_ids,$1),filters=$2 WHERE id=$3',[id,{deliveryDate:t.date,routeDates:[t.date],nextRouteDates:[]},t.link]);
 await t.route(id,'prepare',{snapshot:{textiles:{towelsLarge:2},amenities:{trashSacks100L:1},stockConsumables:[{productId:t.soap,quantity:1}]}});
 run('CREATE DATABASE '+database);created=true;args[7]=database;
 const setup="DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;";
 const file=join(root,'scheduled-fixture.sql');await writeFile(file,setup+'\n'+statements.join('\n').replace(/CREATE ROLE (anon|authenticated|service_role)( BYPASSRLS)?;/g,''));
 execFileSync(exe,[...args,'-f',file],{encoding:'utf8',windowsHide:true,maxBuffer:4e6});
 const concurrent=sql=>new Promise((resolve,reject)=>{let out='',err='';const child=spawn(exe,[...args,'-c',sql],{windowsHide:true});child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(new Error(err)));});
 const tick=`SELECT public.run_scheduled_laundry_completions((SELECT due_at FROM laundry_scheduled_completions WHERE task_key=${literal(id)}));`;
 const cleaner=run(`SELECT cleaner_id FROM laundry_route_workers WHERE id=${literal(t.worker)}`);
 const prepare=`SELECT public.laundry_cycle_route(${literal(id)},${literal(t.link)},'prepare',${literal(t.worker)},${literal(cleaner)},'Prueba nativa',(SELECT p.content_snapshot||jsonb_build_object('cycleGeneration',b.generation) FROM laundry_bag_preparations p JOIN laundry_cycle_bags b ON b.task_key=p.task_id WHERE p.task_id=${literal(id)}),NULL);`;
 // Hold a real task lock while the scheduler starts, then repeat preparation.
 const repeat=concurrent('BEGIN;SET LOCAL lock_timeout=\'5s\';SELECT id FROM tasks WHERE id='+literal(id)+' FOR UPDATE;SELECT pg_sleep(0.5);'+prepare+'COMMIT;');
 await new Promise(resolve=>setTimeout(resolve,100));
 await Promise.all([repeat,concurrent(tick),concurrent(tick)]);
 assert.equal(Number(run(`SELECT current_quantity FROM stock_levels WHERE warehouse_id=${literal(t.central)} AND product_id=${literal(t.productMap.bath_towels)}`)),8);
 assert.equal(run(`SELECT count(*) FROM laundry_cycle_events WHERE task_key=${literal(id)} AND kind='deliver'`),'1');
 assert.equal(run(`SELECT count(*) FROM laundry_cycle_events WHERE task_key=${literal(id)} AND kind='collect'`),'1');
 assert.equal(run(`SELECT status FROM laundry_scheduled_completions WHERE task_key=${literal(id)}`),'completed');
 assert.equal(await concurrent('SET ROLE anon;'+tick).then(()=>false,e=>e.message.includes('permission denied')),true);
 assert.equal(await concurrent('SET ROLE authenticated;SELECT * FROM laundry_scheduled_completions;').then(()=>false,e=>e.message.includes('permission denied')),true);
 console.log('PASS native PostgreSQL: simultaneous ticks + in-flight preparation, no duplicate movements or deadlock; actual grants deny client execution/reads');
}catch(error){console.error(error.message);process.exitCode=1;}finally{
 PGlite.prototype.exec=originalExec;PGlite.prototype.query=originalQuery;if(t)await t.db.close();
 if(created){args[7]='postgres';run('DROP DATABASE '+database+' WITH (FORCE)');}
}
