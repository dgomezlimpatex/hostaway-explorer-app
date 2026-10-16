import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {stockBagDatabase} from './stockBagAccountingTestSupport.mjs';

const t=await stockBagDatabase();
try {
 await t.db.exec(await readFile('supabase/migrations/20261015173000_laundry_replenishment_start.sql','utf8'));
 await t.activate();await t.db.query('UPDATE stock_bag_accounting_config SET active=false');
 await t.configure('all',false,'central','central');await t.open();await t.rpc('activate_laundry_cycle_checked',{_sede:t.sede});
 // Exact deployed auth.role and route V2 guard, previously absent from the fixture.
 await t.db.exec(`CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'))::text $$;
 CREATE OR REPLACE FUNCTION public.guard_route_v2_tracking_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
 DECLARE route_v2_action boolean;
 BEGIN
 SELECT EXISTS(SELECT 1 FROM public.laundry_share_links link WHERE link.id=NEW.share_link_id AND link.workflow_version='route_v2') INTO route_v2_action;
 IF TG_OP='UPDATE' THEN route_v2_action:=route_v2_action OR EXISTS(SELECT 1 FROM public.laundry_share_links link WHERE link.id=OLD.share_link_id AND link.workflow_version='route_v2'); END IF;
 IF route_v2_action AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Route v2 delivery status can only be changed by the route server'; END IF;
 RETURN NEW;END $$;
 CREATE TRIGGER guard_route_v2_tracking_write BEFORE INSERT OR UPDATE ON public.laundry_delivery_tracking FOR EACH ROW EXECUTE FUNCTION public.guard_route_v2_tracking_write();
 CREATE SCHEMA cron;CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;`);
 await t.db.exec(await readFile('supabase/migrations/20261016132409_laundry_scheduled_route_completion.sql','utf8'));
 const id=randomUUID();
 await t.db.query("INSERT INTO tasks(id,propiedad_id,sede_id,date,type,status) VALUES($1,$2,$3,$4,'limpieza-turistica','pending')",[id,t.property,t.sede,t.date]);
 await t.db.query('UPDATE laundry_share_links SET snapshot_task_ids=array_append(snapshot_task_ids,$1),filters=$2 WHERE id=$3',[id,{deliveryDate:t.date,routeDates:[t.date]},t.link]);
 await t.route(id,'prepare',{snapshot:{textiles:{towelsLarge:2},amenities:{trashSacks100L:1},stockConsumables:[{productId:t.soap,quantity:1}]}});
 const job=async()=>(await t.db.query('SELECT * FROM laundry_scheduled_completions WHERE task_key=$1',[id])).rows[0];
 const qty=async()=>Number((await t.db.query('SELECT current_quantity FROM stock_levels WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels])).rows[0].current_quantity);
 const before=await qty();const at=(await job()).due_at;
 assert.deepEqual(await t.rpc('run_scheduled_laundry_completions',{_at:at}),{completed:0,blocked:1});
 assert.equal((await job()).detail,'Route v2 delivery status can only be changed by the route server');
 assert.equal(await qty(),before);
 assert.equal((await t.db.query("SELECT count(*)::int n FROM laundry_cycle_events WHERE task_key=$1 AND kind IN ('deliver','collect')",[id])).rows[0].n,0);
 console.log('PASS reproduces deployed guard failure, full stock/event rollback');
 await t.db.exec(await readFile('supabase/migrations/20261016160304_laundry_scheduler_server_context.sql','utf8'));
 assert.equal((await job()).status,'pending');
 assert.deepEqual(await t.rpc('run_scheduled_laundry_completions',{_at:at}),{completed:1,blocked:0});
 assert.equal(await qty(),before-2);
 assert.equal((await t.db.query('SELECT auth.role() role')).rows[0].role,null);
 assert.deepEqual(await t.rpc('run_scheduled_laundry_completions',{_at:at}),{completed:0,blocked:0});
 assert.equal(await qty(),before-2);
 for(const role of ['anon','authenticated','service_role']){
  assert.equal((await t.db.query("SELECT has_function_privilege($1,'public.complete_scheduled_laundry_bag(uuid,timestamptz)','EXECUTE') allowed",[role])).rows[0].allowed,false);
 }
 await assert.rejects(t.db.query("UPDATE laundry_delivery_tracking SET status='delivered' WHERE task_id=$1",[id]),/only be changed by the route server/);
 await assert.rejects(t.db.query('SELECT public.complete_scheduled_laundry_bag($1,now())',[randomUUID()]),/no rows/);
 assert.equal((await t.db.query('SELECT auth.role() role')).rows[0].role,null);
 // Simulate an API connection while a matching pending job exists. The guard must
 // check session_user, not current_user (which is postgres inside the definer).
 await t.db.exec('CREATE ROLE authenticator; GRANT USAGE ON SCHEMA public TO authenticator; GRANT SELECT,UPDATE ON laundry_delivery_tracking TO authenticator;');
 await t.db.query("UPDATE laundry_scheduled_completions SET status='pending' WHERE task_key=$1",[id]);
 await t.db.exec('SET SESSION AUTHORIZATION authenticator;');
 await assert.rejects(t.db.query("UPDATE laundry_delivery_tracking SET status='delivered' WHERE task_id=$1",[id]),/only be changed by the route server/);
 await t.db.exec('RESET SESSION AUTHORIZATION;');
 console.log('PASS internal connection plus pending operation; retry once, no duplicate; client privileges unchanged and API identity rejected even with pending job');
} finally {await t.db.close();}
