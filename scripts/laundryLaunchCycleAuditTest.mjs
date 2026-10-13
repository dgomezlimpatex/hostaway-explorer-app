import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { receiptTestDatabase } from './laundryReceiptTestSupport.mjs';

// Exact function definitions read from production on 13/10, executed only in
// PGlite memory with invented identities, quantities and sessions. No network.
const snapshot = JSON.parse(await readFile(new URL('./fixtures/laundryLaunchBackend20261013.json', import.meta.url), 'utf8'));
const receiptSnapshot = JSON.parse(await readFile(new URL('./fixtures/laundryLaunchReceipt20261013.json', import.meta.url), 'utf8'));
const t = await receiptTestDatabase();
const { db, rpc, mutate, state, sede, warehouse: central, productMap } = t;
const building = randomUUID(), property = randomUUID(), task = randomUUID();
const towel = productMap.bath_towels, sheet = productMap.double_sheets;
const actor = randomUUID();
let checks = 0;
const check = label => { checks++; console.log(`OK ${label}`); };
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const q = async (table, where, args) => Number((await one(`SELECT current_quantity AS n FROM ${table} WHERE ${where}`, args))?.n ?? 0);
const route = (action, id = task, key) => rpc('process_laundry_route_inventory_event', {
  task_id_param: id, action_param: action, event_key_param: key ?? `audit-${id}-${action}`, actor_id_param: null, actor_name_param: 'Persona de prueba',
});
const receive = (lines, key = randomUUID()) => rpc('receive_laundry_batch', {
  warehouse_id_param: central, lines_param: lines, reason_param: 'Lote de prueba', user_id_param: actor, event_key_param: key,
});
try {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin','manager','logistics');
    CREATE TYPE public.stock_item_kind AS ENUM ('laundry','amenity','other');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('fixture.uid',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1=auth.uid() $$;
    ALTER TABLE stock_categories ALTER COLUMN kind TYPE public.stock_item_kind USING kind::public.stock_item_kind;
    ALTER TABLE stock_warehouses ADD COLUMN is_default boolean DEFAULT false;
    ALTER TABLE stock_warehouses ADD COLUMN property_group_id uuid;
    ALTER TABLE stock_movements ADD COLUMN task_id uuid;
    ALTER TABLE stock_movements ADD COLUMN property_id uuid;
    ALTER TABLE stock_movements ADD COLUMN created_by uuid;
    CREATE TABLE properties(id uuid PRIMARY KEY,sede_id uuid,default_stock_warehouse_id uuid,
      numero_sabanas numeric DEFAULT 0,numero_sabanas_pequenas numeric DEFAULT 0,numero_sabanas_suite numeric DEFAULT 0,
      numero_toallas_grandes numeric DEFAULT 0,numero_toallas_pequenas numeric DEFAULT 0,numero_alfombrines numeric DEFAULT 0,numero_fundas_almohada numeric DEFAULT 0);
    CREATE TABLE tasks(id uuid PRIMARY KEY,propiedad_id uuid,sede_id uuid,type text,status text);
    CREATE TABLE stock_sede_settings(sede_id uuid PRIMARY KEY,laundry_route_inventory_enabled boolean);
    CREATE TABLE stock_property_consumption_rules(property_id uuid,product_id uuid,warehouse_id uuid,quantity_per_cleaning numeric,is_active boolean);
    CREATE TABLE stock_property_field_mappings(sede_id uuid,product_id uuid,warehouse_id uuid,property_field text,multiplier numeric,is_active boolean);
    CREATE TABLE laundry_apartment_stock(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid,product_id uuid,current_quantity numeric,updated_by uuid,updated_at timestamptz DEFAULT now(),UNIQUE(property_id,product_id));
    CREATE TABLE laundry_dirty_stock(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid,warehouse_id uuid,current_quantity numeric,updated_by uuid,UNIQUE(product_id,warehouse_id));
    CREATE TABLE laundry_dirty_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid,warehouse_id uuid,movement_type text,quantity numeric,previous_quantity numeric,new_quantity numeric,reason text,task_id uuid,property_id uuid,created_by uuid);
    CREATE TABLE laundry_rejected_stock(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid,product_id uuid,warehouse_id uuid,current_quantity numeric,reason text,updated_by uuid,updated_at timestamptz DEFAULT now());
    CREATE TABLE laundry_inventory_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_key text,event_type text,task_id uuid,property_id uuid,product_id uuid,warehouse_id uuid,quantity numeric,from_location text,to_location text,metadata jsonb,created_by uuid,UNIQUE(event_key,product_id));
  `);
  for (const { definition } of [...snapshot.rpcDefinitions, ...receiptSnapshot.rpcDefinitions]) await db.exec(definition);
  await db.query("SELECT set_config('fixture.uid',$1,false)", [actor]);
  await db.query('UPDATE stock_warehouses SET is_default=true WHERE id=$1', [central]);
  await db.query("INSERT INTO stock_warehouses(id,sede_id,name,location_type,property_group_id) VALUES($1,$2,'Edificio de prueba','building_storage',$3)", [building, sede, randomUUID()]);
  await db.query('INSERT INTO properties(id,sede_id,default_stock_warehouse_id,numero_toallas_grandes) VALUES($1,$2,$3,2)', [property, sede, central]);
  await db.query("INSERT INTO tasks VALUES($1,$2,$3,'limpieza-turistica','pending')", [task, property, sede]);
  await db.query('INSERT INTO stock_sede_settings VALUES($1,false)', [sede]);
  await db.query('INSERT INTO stock_property_consumption_rules VALUES($1,$2,$3,2,true)', [property, towel, central]);
  await db.query('INSERT INTO stock_property_field_mappings VALUES($1,$2,$3,\'numero_toallas_grandes\',1,true)', [sede, towel, central]);
  await db.query('INSERT INTO stock_levels(product_id,warehouse_id,current_quantity) VALUES($1,$2,10),($1,$3,4)', [towel, central, building]);
  await db.query('INSERT INTO laundry_apartment_stock(property_id,product_id,current_quantity) VALUES($1,$2,2)', [property, towel]);
  const clean = () => q('stock_levels', 'warehouse_id=$1 AND product_id=$2', [central, towel]);
  const installed = () => q('laundry_apartment_stock', 'property_id=$1 AND product_id=$2', [property, towel]);
  const dirty = () => q('laundry_dirty_stock', 'warehouse_id=$1 AND product_id=$2', [central, towel]);
  const discarded = () => q('laundry_rejected_stock', 'warehouse_id=$1 AND product_id=$2 AND property_id IS NULL', [central, towel]);

  assert.equal((await route('deliver')).processed, 1);
  assert.equal(await clean(), 8); assert.equal(await installed(), 4);
  assert.equal(await q('stock_levels', 'warehouse_id=$1 AND product_id=$2', [building, towel]), 4);
  check('current delivery debits central and increases apartment, without using the building storage');
  assert.equal((await route('deliver')).skipped, 1); assert.equal(await clean(), 8);
  check('same delivery key does not debit twice');
  await db.query("UPDATE tasks SET status='completed' WHERE id=$1", [task]);
  assert.equal(await installed(), 4); assert.equal(await dirty(), 0);
  assert.ok(!snapshot.taskTriggers.some(x => /laundry_cleaning|laundry_dirty/.test(x.function)));
  check('no deployed task trigger connects cleaning completion with a textile change');
  assert.equal((await route('collect')).processed, 1);
  assert.equal(await installed(), 2); assert.equal(await dirty(), 2);
  assert.equal((await route('collect')).skipped, 1); assert.equal(await dirty(), 2);
  check('current collection decrements apartment and adds dirty stock at the source warehouse once');

  await mutate({ action: 'start' });
  await mutate({ action: 'add', material: 'bath_towels', quantity: 1 });
  await mutate({ action: 'add_discard', material: 'bath_towels', quantity: 1 });
  const confirmation = randomUUID();
  let receipt = await state();
  await mutate({ action: 'confirm', expectedRevision: receipt.receipt.revision }, { id: confirmation });
  assert.equal(await clean(), 9); assert.equal(await dirty(), 2); assert.equal(await discarded(), 0);
  check('exact public receipt accepts one, excludes one discard, leaves outstanding dirty stock unchanged');
  await mutate({ action: 'confirm', expectedRevision: receipt.receipt.revision }, { id: confirmation });
  assert.equal(await clean(), 9);
  check('public confirmation retry does not add clean stock twice');
  receipt = await state();
  await mutate({ action: 'set_discard', material: 'bath_towels', quantity: 2, expectedRevision: receipt.receipt.revision });
  receipt = await state();
  await mutate({ action: 'confirm', expectedRevision: receipt.receipt.revision });
  assert.equal(await clean(), 9); assert.equal(await dirty(), 2);
  check('discard-only correction does not alter clean or dirty stock');

  const batchKey = randomUUID();
  const line = { product_id: towel, accepted_quantity: 1, rejected_quantity: 1, rejection_reason: 'Rotura de prueba' };
  assert.equal((await receive([line], batchKey)).processed, 1);
  assert.equal(await clean(), 10); assert.equal(await dirty(), 0); assert.equal(await discarded(), 1);
  assert.equal((await receive([line], batchKey)).skipped, 1); assert.equal(await clean(), 10);
  check('the separate closed receipt RPC closes dirty stock, splits accepted/rejected and retries safely');
  assert.equal(await clean() + await installed() + await dirty() + await discarded() + 4, 17);
  check('processing the same physical receipt with both writers would count its accepted unit twice');
  await assert.rejects(receive([{ ...line, accepted_quantity: 2 }]), /supera/);
  assert.equal(await clean(), 10);
  check('closed reception rejects quantities above the dirty balance');

  await db.query('UPDATE laundry_dirty_stock SET current_quantity=2 WHERE product_id=$1 AND warehouse_id=$2', [towel, central]);
  const failedKey = randomUUID();
  await assert.rejects(receive([
    { product_id: towel, accepted_quantity: 1, rejected_quantity: 0 },
    { product_id: sheet, accepted_quantity: 1, rejected_quantity: 0 },
  ], failedKey), /supera/);
  assert.equal(await clean(), 10); assert.equal(await dirty(), 2);
  assert.equal(Number((await one('SELECT count(*) AS n FROM laundry_inventory_events WHERE event_key=$1', [failedKey])).n), 0);
  check('second reception line failure rolls back the first balance and event');

  const missingProperty = randomUUID(), missingTask = randomUUID();
  await db.query('INSERT INTO properties(id,sede_id,default_stock_warehouse_id,numero_toallas_grandes) VALUES($1,$2,$3,2)', [missingProperty, sede, central]);
  await db.query("INSERT INTO tasks VALUES($1,$2,$3,'limpieza-turistica','pending')", [missingTask, missingProperty, sede]);
  assert.equal((await route('collect', missingTask)).processed, 1);
  assert.equal(await q('laundry_apartment_stock', 'property_id=$1 AND product_id=$2', [missingProperty, towel]), 0);
  assert.equal(await dirty(), 4);
  check('inner collection creates an uncounted opening set; the existing guarded wrapper must be used');

  await db.query('UPDATE stock_levels SET current_quantity=1 WHERE warehouse_id=$1 AND product_id=$2', [central, towel]);
  await assert.rejects(route('deliver', missingTask), /suficiente/);
  assert.equal(await clean(), 1);
  assert.equal(Number((await one('SELECT count(*) AS n FROM laundry_inventory_events WHERE event_key=$1', [`audit-${missingTask}-deliver`])).n), 0);
  check('insufficient clean stock leaves no delivery event');
  console.log(`PASS ${checks} production-contract checks in isolated Postgres WASM. Known gaps reproduced, not a production activation or concurrent Postgres test.`);
} finally { await db.close(); }
