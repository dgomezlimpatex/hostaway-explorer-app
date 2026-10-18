import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const fixture=JSON.parse(await readFile(new URL('./assistantReadFixtures.json',import.meta.url),'utf8'));
const extra=JSON.parse(await readFile(new URL('./assistantHistoryReadFixtures.json',import.meta.url),'utf8'));
fixture.schema.push(...extra.schema);
for(const p of ['limpatexconsultor','limpatexoperaciones'])fixture.permissions[p].push('edificios','vinculos_edificios','equipos_edificios');
const db=new PGlite();
const migration=await readFile(new URL('../supabase/migrations/20261018065011_hermes_readonly_access.sql',import.meta.url),'utf8');
const id='00000000-0000-4000-8000-000000000001';
let checks=0;
try {
 await db.exec(`create role anon; create role authenticated; create schema extensions;
 create function extensions.digest(v text, algorithm text) returns bytea language sql immutable as $$ select sha256(convert_to(v,'UTF8')) $$;`);
 const tables=Object.groupBy(fixture.schema,c=>c.table_name);
 for(const [table,columns] of Object.entries(tables)) {
  await db.exec(`create table public.${table} (${columns.map(c=>`"${c.column_name}" ${c.data_type==='USER-DEFINED'?'text':c.data_type}`).join(',')}); alter table public.${table} enable row level security;`);
  const values=columns.map(c=>c.data_type==='uuid'?id:c.data_type.includes('timestamp')?'2026-10-18T10:00:00+02:00':c.data_type==='date'?'2026-10-18':c.data_type.includes('time')?'10:00:00':c.data_type==='boolean'?true:c.data_type==='jsonb'?JSON.stringify(c.column_name==='document'?{version:1,rates:[],adjustments:{},expenses:[],incomes:[],policies:[]}:{bath_towels:2}):['integer','bigint','numeric'].includes(c.data_type)?2:c.column_name==='quantity_basis'?'estimated':'Prueba');
  await db.query(`insert into public.${table} values(${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
 }
 await db.exec(migration);
 await db.exec('begin;'+await readFile(new URL('../supabase/migrations/20261018111006_hermes_history_read_scope.sql',import.meta.url),'utf8')+'commit;');
 const keys={};for(const profile of Object.keys(fixture.permissions)) {
  keys[profile]=(profile+'-').padEnd(50,'x');
  await db.query('insert into limpatex_assistant_private.identities(profile,token_hash,expires_at) values($1,$2,now()+interval \'1 day\')',[profile,createHash('sha256').update(keys[profile]).digest('hex')]);
 }
 await db.exec('set role anon');
 const call=(key,resource,extra={})=>db.query('select public.limpatex_assistant_read($1,$2,$3,$4,$5,$6,$7,$8) result',[key,resource,extra.from||'2026-10-01',extra.to||'2026-10-31',extra.search||'',extra.id||null,extra.limit??50,extra.offset??0]).then(r=>r.rows[0].result);
 for(const [profile,allowed] of Object.entries(fixture.permissions)) {
  const who=await call(keys[profile],'permisos');assert.equal(who.profile,profile);assert.deepEqual(who.resources,allowed);checks++;
  for(const resource of Object.keys(fixture.permissions).flatMap(k=>fixture.permissions[k]).filter((x,i,a)=>a.indexOf(x)===i)) {
   if(allowed.includes(resource)) {const r=await call(keys[profile],resource);assert.equal(r.read_only,true);assert.equal(r.rows.length,1,profile+'/'+resource);checks++;}
   else {await assert.rejects(call(keys[profile],resource),/no autorizada/);checks++;}
  }
  for(const operation of ['update','delete','insert','sql','rpc','clients; drop table clients']) {await assert.rejects(call(keys[profile],operation),/no autorizada/);checks++;}
 }
 await assert.rejects(call('invalid','permisos'),/no válido/);checks++;
 await assert.rejects(call('x'.repeat(50),'clientes'),/no válido/);checks++;
 await assert.rejects(call(keys.limpatexconsultor,'tareas',{limit:101}),/paginación/);checks++;
 await assert.rejects(call(keys.limpatexconsultor,'tareas',{from:'2020-01-01',to:'2026-10-18'}),/366 días/);checks++;
 assert.equal((await call(keys.limpatexcomercial,'clientes',{search:"'; drop table clients;--"})).rows.length,0);checks++;
 const inventory=await call(keys.limpatexoperaciones,'inventario');assert.equal(inventory.rows[0].base_cantidad,'estimated');checks++;
 const absences=await call(keys.limpatexoperaciones,'ausencias',{from:'2026-10-18',to:'2026-10-18'});assert.equal(absences.rows.length,1);checks++;
 for(const r of [await call(keys.limpatexcomercial,'clientes'),await call(keys.limpatexoperaciones,'equipo')]) {assert(!JSON.stringify(r).match(/"(?:pin|email|telefono|token|dni|hourly_rate)"/));checks++;}
 for(const role of ['anon','limpatex_bot_reader']) {
  await db.exec('reset role; set role '+role);
  for(const table of Object.keys(tables)) {
   for(const sql of [`update public.${table} set ${tables[table][0].column_name}=${tables[table][0].column_name} where false`,`delete from public.${table} where false`,`insert into public.${table} default values`]) {await assert.rejects(db.exec(sql),/permission denied/);checks++;}
  }
 }
 await db.exec('reset role');
 await db.query('update limpatex_assistant_private.identities set active=false where profile=$1',['limpatexcomercial']);
 await db.exec('set role anon');await assert.rejects(call(keys.limpatexcomercial,'clientes'),/no válido/);checks++;
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from tasks')).rows[0].n,1);
 const fn=(await db.query("select p.provolatile,r.rolname,r.rolcanlogin,r.rolbypassrls from pg_proc p join pg_roles r on r.oid=p.proowner where p.proname='limpatex_assistant_read'")).rows[0];
 assert.equal(fn.provolatile,'s');assert.equal(fn.rolname,'limpatex_bot_reader');assert.equal(fn.rolcanlogin,false);assert.equal(fn.rolbypassrls,false);checks++;
 const membership=(await db.query("select m.set_option,m.inherit_option from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member where r.rolname='limpatex_bot_reader' and u.rolname='postgres'")).rows[0];
 assert.equal(membership.set_option,false);assert.equal(membership.inherit_option,false);checks++;
 await db.exec('set role limpatex_bot_reader');
 for(const [table,column] of [['property_groups','general_instructions'],['cleaner_group_assignments','notes']]) {await assert.rejects(db.exec(`select ${column} from public.${table}`),/permission denied/);checks++;}
 await db.exec('reset role');
 console.log(JSON.stringify({ok:true,checks,scope:'isolated PostgreSQL fixtures; no production writes'}));
} finally {await db.close();}
