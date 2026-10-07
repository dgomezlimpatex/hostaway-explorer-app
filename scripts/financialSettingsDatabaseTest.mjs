import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const site='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002',user='20000000-0000-0000-0000-000000000001';
const document=JSON.stringify({version:1,rates:[],expenses:[],adjustments:{}});
try {
  await db.exec(`create role anon; create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.sedes(id uuid primary key);create type public.app_role as enum('admin','manager','supervisor','cleaner');
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function public.get_user_accessible_sedes() returns uuid[] language sql as $$select array[current_setting('test.site',true)::uuid]$$;
    create function public.has_role(uuid,public.app_role) returns boolean language sql as $$select $2::text=current_setting('test.role',true)$$;
    grant usage on schema public,auth to authenticated,anon;insert into auth.users values('${user}');insert into sedes values('${site}'),('${other}');`);
  await db.exec(readFileSync('supabase/migrations/20261007180000_financial_settings.sql','utf8'));
  await db.query('insert into financial_settings(sede_id,document) values($1,$2::jsonb)',[site,document]);
  await db.query('insert into financial_settings(sede_id,document) values($1,$2::jsonb)',[other,document]);
  await db.exec(`set role authenticated;set test.uid='${user}';set test.site='${site}';set test.role='manager';`);
  assert.equal((await db.query('select * from financial_settings')).rows.length,1);
  assert.equal((await db.query('select * from financial_settings where sede_id=$1',[other])).rows.length,0);
  await assert.rejects(()=>db.query('insert into financial_settings(sede_id,document) values($1,$2::jsonb)',[other,document]),/row-level security/);
  const update=await db.query('update financial_settings set document=$1::jsonb,revision=2 where sede_id=$2 and revision=1 returning revision,updated_by',[document,site]);
  assert.equal(update.rows[0].revision,2);assert.equal(update.rows[0].updated_by,user);
  await assert.rejects(()=>db.query("update financial_settings set document='{}'::jsonb,revision=3 where sede_id=$1",[site]),/check constraint/);
  // Two editors read revision 1: the second save must affect zero rows, never overwrite.
  assert.equal((await db.query('update financial_settings set document=$1::jsonb,revision=2 where sede_id=$2 and revision=1 returning revision',[document,site])).rows.length,0);
  await assert.rejects(()=>db.query('update financial_settings set revision=4 where sede_id=$1',[site]),/Invalid financial revision/);
  await assert.rejects(()=>db.query('update financial_settings set sede_id=$1,revision=3 where sede_id=$2',[other,site]));
  await assert.rejects(()=>db.query('delete from financial_settings where sede_id=$1',[site]),/permission denied/);
  for(const role of ['supervisor','cleaner']){await db.exec(`set test.role='${role}'`);assert.equal((await db.query('select * from financial_settings')).rows.length,0);assert.equal((await db.query('update financial_settings set revision=3 returning revision')).rows.length,0);}
  await db.exec('reset role;set role anon;');await assert.rejects(()=>db.query('select * from financial_settings'),/permission denied/);
  await db.exec('reset role;');assert.equal((await db.query("select relrowsecurity from pg_class where relname='financial_settings'")).rows[0].relrowsecurity,true);
  console.log('financial-settings-db: actual migration, RLS by role/site, no anonymous access, no delete, revision CAS and audit stamp passed in isolated Postgres');
}finally{await db.close();}
