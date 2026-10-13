import { receiptTestDatabase } from './laundryReceiptTestSupport.mjs';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
export async function completeCycleDatabase() {
 const t=await receiptTestDatabase(); const {db,sede,warehouse:central,admin,worker,productMap}=t;
 try {
 const property=randomUUID(), solo=randomUUID(), building=randomUUID(), group=randomUUID(), link=randomUUID(), task=randomUUID(), second=randomUUID(), direct=randomUUID();
 await db.exec(`
 CREATE TYPE public.stock_item_kind AS ENUM ('laundry','amenity','other');
 CREATE TYPE public.laundry_delivery_status AS ENUM ('pending','prepared','delivered');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('fixture.uid',true),'')::uuid $$;
 ALTER TABLE stock_categories ALTER COLUMN kind TYPE public.stock_item_kind USING kind::public.stock_item_kind;
 ALTER TABLE stock_warehouses ADD COLUMN property_group_id uuid;
 ALTER TABLE stock_warehouses ADD COLUMN is_default boolean DEFAULT false;
 ALTER TABLE stock_products ADD COLUMN name text DEFAULT 'Producto de prueba';
 ALTER TABLE stock_products ADD COLUMN unit_of_measure text DEFAULT 'unidades';
 ALTER TABLE stock_movements ADD COLUMN task_id uuid;
 ALTER TABLE stock_movements ADD COLUMN property_id uuid;
 ALTER TABLE stock_movements ADD COLUMN created_by uuid;
 CREATE TABLE clients(id uuid PRIMARY KEY,is_active boolean,linen_control_enabled boolean);
 CREATE TABLE properties(id uuid PRIMARY KEY,sede_id uuid,codigo text,cliente_id uuid,is_active boolean,linen_control_enabled boolean,default_stock_warehouse_id uuid,
 numero_sabanas numeric DEFAULT 0,numero_sabanas_pequenas numeric DEFAULT 0,numero_sabanas_suite numeric DEFAULT 0,numero_toallas_grandes numeric DEFAULT 2,numero_toallas_pequenas numeric DEFAULT 0,numero_alfombrines numeric DEFAULT 0,numero_fundas_almohada numeric DEFAULT 0);
 CREATE TABLE tasks(id uuid PRIMARY KEY,propiedad_id uuid,sede_id uuid,date date,type text,status text);
 CREATE TABLE property_group_assignments(property_id uuid,property_group_id uuid);
 CREATE TABLE stock_property_consumption_rules(property_id uuid,product_id uuid,warehouse_id uuid,quantity_per_cleaning numeric,is_active boolean);
 CREATE TABLE stock_property_field_mappings(sede_id uuid,product_id uuid,warehouse_id uuid,property_field text,multiplier numeric,is_active boolean);
 CREATE TABLE stock_sede_settings(sede_id uuid PRIMARY KEY,auto_consumption_enabled boolean DEFAULT false,laundry_route_inventory_enabled boolean DEFAULT false);
 CREATE TABLE laundry_apartment_stock(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid,product_id uuid,current_quantity numeric,updated_at timestamptz DEFAULT now(),UNIQUE(property_id,product_id));
 CREATE TABLE laundry_dirty_stock(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),warehouse_id uuid,product_id uuid,current_quantity numeric CHECK(current_quantity>=0),UNIQUE(warehouse_id,product_id));
 CREATE TABLE laundry_rejected_stock(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),warehouse_id uuid,product_id uuid,current_quantity numeric CHECK(current_quantity>=0),UNIQUE(warehouse_id,product_id));
 CREATE TABLE laundry_share_links(id uuid PRIMARY KEY,sede_id uuid,is_active boolean,workflow_version text,expires_at timestamptz,snapshot_task_ids uuid[],filters jsonb);
 CREATE TABLE laundry_delivery_tracking(share_link_id uuid,task_id uuid,status laundry_delivery_status,collection_status text,delivered_at timestamptz,collected_at timestamptz,UNIQUE(share_link_id,task_id));
 ALTER TABLE laundry_delivery_tracking ADD COLUMN delivered_by_name text,ADD COLUMN collected_by_name text,ADD COLUMN delivered_by_worker_id uuid,ADD COLUMN collected_by_worker_id uuid;
 CREATE TABLE laundry_route_worker_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),share_link_id uuid,task_id uuid,route_worker_id uuid,worker_name text,action text,details jsonb);
 CREATE TABLE laundry_bag_preparations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid UNIQUE,status text,last_share_link_id uuid,updated_at timestamptz,route_novelty_resolved boolean,content_snapshot jsonb,snapshot_locked_at timestamptz,prepared_at timestamptz,prepared_by_name text,prepared_by_worker_id uuid,issue_at timestamptz,issue_by_name text,issue_by_worker_id uuid,issue_reason text);
 ALTER TABLE laundry_bag_preparations ADD COLUMN route_delivery_status text DEFAULT 'pending',ADD COLUMN route_novelty_type text DEFAULT 'normal',ADD COLUMN undone_at timestamptz,ADD COLUMN undone_reason text,ADD COLUMN undone_by_name text;
 `);
 for(const f of JSON.parse(await readFile(new URL('./fixtures/laundryCompleteDeployedContracts20261013.json',import.meta.url),'utf8')))await db.exec(f.definition);
 await db.exec(await readFile(new URL('../supabase/migrations/20261013160000_laundry_complete_cycle.sql',import.meta.url),'utf8'));
 await db.query("SELECT set_config('fixture.uid',$1,false)",[admin]);
 const date=t.date;
 await db.query("INSERT INTO stock_warehouses(id,sede_id,name,location_type,property_group_id) VALUES($1,$2,'Edificio de prueba','building_storage',$3)",[building,sede,group]);
 await db.query('UPDATE stock_warehouses SET is_default=true WHERE id=$1',[central]);
 await db.query("INSERT INTO properties(id,sede_id,codigo,is_active,linen_control_enabled,default_stock_warehouse_id) VALUES($1,$3,'DEMO-EDIFICIO',true,true,$4),($2,$3,'DEMO-DIRECTA',true,true,$4)",[property,solo,sede,central]);
 await db.query('INSERT INTO property_group_assignments VALUES($1,$2)',[property,group]);
 await db.query("INSERT INTO tasks VALUES($1,$4,$6,$7,'limpieza-turistica','pending'),($2,$4,$6,$7,'limpieza-turistica','pending'),($3,$5,$6,$7,'limpieza-turistica','pending')",[task,second,direct,property,solo,sede,date]);
 await db.query("INSERT INTO laundry_share_links VALUES($1,$2,true,'route_v2',NULL,$3,$4)",[link,sede,[task,second,direct],JSON.stringify({routeDates:[date],nextRouteDates:[]})]);
 await db.query('INSERT INTO stock_sede_settings(sede_id) VALUES($1)',[sede]);
 await db.query("INSERT INTO stock_property_field_mappings VALUES($1,$2,$3,'numero_toallas_grandes',1,true)",[sede,productMap.bath_towels,central]);
 const cleaner=(await db.query('SELECT cleaner_id FROM laundry_route_workers WHERE id=$1',[worker])).rows[0].cleaner_id;
 const route=async(id,action,opts={})=>{
 const taskRow=(await db.query('SELECT t.*,coalesce(b.generation,0) generation FROM tasks t LEFT JOIN laundry_cycle_bags b ON b.task_key=t.id WHERE t.id=$1',[id])).rows[0];
 return t.rpc('laundry_cycle_route',{_task:id,_link:link,_action:action,_worker:opts.worker??worker,_cleaner:cleaner,_name:'Persona de prueba',_snapshot:{taskId:id,propertyId:taskRow.propiedad_id,date:date,cycleGeneration:taskRow.generation,cycleLines:action==='prepare'?await t.rpc('laundry_cycle_lines',{_task:id}):[],dirtyLines:await t.rpc('laundry_cycle_dirty_lines',{_property:taskRow.propiedad_id,_sede:sede}),...opts.snapshot},_issue:opts.issue??null});
 };
 const counts=Object.values(productMap).flatMap(p=>[
 {productId:p,warehouseId:central,kind:'clean',quantity:p===productMap.bath_towels?10:0,preparedQuantity:0},
 {productId:p,warehouseId:building,kind:'clean',quantity:p===productMap.bath_towels?4:0,preparedQuantity:0},
 {productId:p,kind:'outside',quantity:p===productMap.bath_towels?2:0},
 {productId:p,warehouseId:central,kind:'rejected',quantity:0},
 {productId:p,warehouseId:central,kind:'collected',quantity:0},
 {productId:p,propertyId:solo,kind:'clean',quantity:0,preparedQuantity:0},
 ...[property,solo].flatMap(prop=>[
 {productId:p,propertyId:prop,kind:'installed',quantity:p===productMap.bath_towels?2:0},
 {productId:p,propertyId:prop,warehouseId:prop===property?building:null,kind:'dirty',quantity:0},
 ]),
 ]);
 const configure=(collection='all',strict=false,destination='laundry',rejection='immediate')=>t.rpc('configure_laundry_cycle_checked',{_sede:sede,_central:central,_properties:[property,solo],_start:date,_collection:collection,_strict:strict,_destination:destination,_rejection:rejection});
 const open=()=>t.rpc('open_laundry_cycle_checked',{_sede:sede,_counts:counts,_measured:new Date(Date.now()-5000).toISOString()});
 const activate=()=>t.rpc('activate_laundry_cycle_checked',{_sede:sede});
 return {...t,central,building,property,solo,task,second,direct,link,route,configure,open,activate,counts};
 } catch(error) { await db.close(); throw new Error(error.message+' '+(error.where??'')); }
}
