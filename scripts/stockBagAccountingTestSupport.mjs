import {completeCycleDatabase} from './laundryCompleteCycleTestSupport.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
export async function stockBagDatabase() {
 const t=await completeCycleDatabase();
 try {
 const {db,sede,central,productMap,task,second,property}=t;
 const soap=randomUUID(),sack=randomUUID(),category=randomUUID();
 await db.exec(`
 ALTER TABLE stock_levels ADD COLUMN cost_per_unit numeric;
 ALTER TABLE stock_movements ADD COLUMN unit_cost_at_movement numeric;
 ALTER TABLE stock_levels DROP CONSTRAINT stock_levels_current_quantity_check;
 ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_non_negative CHECK(current_quantity>=0 AND minimum_quantity>=0 AND target_quantity>=0 AND (cost_per_unit IS NULL OR cost_per_unit>=0));
 ALTER TABLE stock_products ADD COLUMN sku text,ADD COLUMN is_consumable boolean DEFAULT true;
 ALTER TABLE stock_sede_settings ADD COLUMN estimated_amenities_enabled boolean DEFAULT true,ADD COLUMN estimated_amenities_started_at timestamptz DEFAULT now();
 ALTER TABLE tasks ADD COLUMN end_time time DEFAULT '12:00';
 ALTER TABLE clients ADD COLUMN sede_id uuid;
 CREATE TABLE laundry_bag_action_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_key uuid,share_link_id uuid,sede_id uuid,action text,actor_name text,issue_reason text,bag_items jsonb,happened_at timestamptz DEFAULT now());
 CREATE TABLE stock_estimated_amenity_entries(id uuid DEFAULT gen_random_uuid(),task_key uuid,sede_id uuid,property_id uuid,product_id uuid,warehouse_id uuid,quantity numeric,unit_cost_at_consumption numeric,scheduled_end_at timestamptz,state text DEFAULT 'applied',movement_id uuid,reversal_movement_id uuid,applied_at timestamptz DEFAULT now(),reversed_at timestamptz,UNIQUE(task_key,product_id));
 CREATE TABLE stock_estimated_amenity_runs(task_key uuid PRIMARY KEY,sede_id uuid,complete boolean,next_retry_at timestamptz,attempts integer DEFAULT 0,last_seen_at timestamptz,last_run_at timestamptz,last_attempt_at timestamptz,issue_code text);
 CREATE TABLE stock_estimated_amenity_issues(task_key uuid,product_id uuid,sede_id uuid,issue_code text,last_seen_at timestamptz DEFAULT now(),resolved_at timestamptz,UNIQUE(task_key,product_id));
 `);
 await db.query("INSERT INTO stock_categories(id,kind) VALUES($1,'amenity')",[category]);
 await db.query("INSERT INTO stock_products(id,sede_id,category_id,name,sku) VALUES($1,$3,$4,'Amenities de prueba',NULL),($2,$3,$4,'Sacos de basura 100 L','SACOS-BASURA-100L')",[soap,sack,sede,category]);
 await db.query('INSERT INTO stock_levels(product_id,warehouse_id,current_quantity) VALUES($1,$3,7),($2,$3,9)',[soap,sack,central]);
 for(const product of Object.values(productMap)) await db.query('INSERT INTO stock_levels(product_id,warehouse_id,current_quantity) VALUES($1,$2,0) ON CONFLICT DO NOTHING',[product,central]);
 const sourceFiles=['20261014173000_stock_bag_accounting.sql','20261014173100_stock_bag_estimated_cutover.sql'];
 for(const f of sourceFiles) await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 await db.exec(`CREATE TRIGGER record_laundry_bag_action AFTER INSERT OR UPDATE OF status,content_snapshot ON laundry_bag_preparations FOR EACH ROW EXECUTE FUNCTION record_laundry_bag_action();
 CREATE TRIGGER reverse_estimated_amenities_on_cancellation BEFORE UPDATE OF status OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION reverse_estimated_amenities_on_cancellation();`);
 const date=t.date;
 const start=(await db.query("SELECT ($1::date-3)::text AS day",[date])).rows[0].day;
 const before=(await db.query("SELECT ($1::date-4)::text AS day",[date])).rows[0].day;
 const snapshot=(towels=2,amenities=1,sacks=1,id=task)=>({taskId:id,propertyId:property,date,textiles:{sheets:0,sheetsSmall:0,sheetsSuite:0,pillowCases:0,towelsLarge:towels,towelsSmall:0,bathMats:0},amenities:{trashSacks100L:sacks},stockConsumables:[{productId:soap,quantity:amenities}]});
 const insertMovement=async(product,previous,next,kind='entrada',reason='Entrada de prueba')=>db.query('INSERT INTO stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason) VALUES($1,$2,$3,abs($4::numeric-$5::numeric),$5,$4,$6)',[product,central,kind,next,previous,reason]);
 await insertMovement(productMap.bath_towels,0,3,'entrada',`Recepción ${start} v1 · synthetic`);
 await insertMovement(soap,0,20);
 await insertMovement(sack,0,10);
 const prepare=(id=task,snap=snapshot(2,1,1,id))=>db.query(`INSERT INTO laundry_bag_preparations(task_id,status,content_snapshot,prepared_at,prepared_by_name,last_share_link_id) VALUES($1,'prepared',$2,now(),'Prueba',$3)
 ON CONFLICT(task_id) DO UPDATE SET status='prepared',content_snapshot=EXCLUDED.content_snapshot,prepared_at=now()`,[id,snap,t.link]);
 await prepare();await prepare(second,snapshot(4,1,1,second));
 const preview=()=>t.rpc('preview_stock_bag_accounting_checked',{_sede:sede,_central:central,_start:start});
 const activate=async(plan,operation=randomUUID())=>t.rpc('activate_stock_bag_accounting_checked',{_sede:sede,_central:central,_start:start,_fingerprint:(plan??await preview()).fingerprint,_operation:operation});
 const level=async(product=productMap.bath_towels)=>(await db.query('SELECT * FROM stock_levels WHERE warehouse_id=$1 AND product_id=$2',[central,product])).rows[0];
 const adjust=async(product,kind,quantity,{verified=false,operation=randomUUID(),version}={})=>t.rpc('adjust_bag_stock_checked',{_level:(await level(product)).id,_kind:kind,_quantity:quantity,_reason:'Prueba de operación',_cost:null,_version:version??(await level(product)).stock_version,_verified:verified,_operation:operation});
 return {...t,soap,sack,start,before,snapshot,prepare,preview,activate,level,adjust,insertMovement};
 } catch(error) {await t.db.close();throw error;}
}
