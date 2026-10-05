import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

export const materialKeys = [
  "double_sheets",
  "single_sheets",
  "pillowcases",
  "bath_towels",
  "hand_towels",
  "bath_mats",
  "duvets",
  "mattress_protectors",
  "pillows",
];
export async function receiptTestDatabase() {
  const db = new PGlite();
  // Synthetic pre-existing contracts. PIN verifier is a fixture only: the new
  // migration calls the existing production verifier and never changes PIN storage.
  await db.exec(`
    CREATE SCHEMA extensions;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE FUNCTION extensions.gen_random_bytes(n integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(string_agg(md5(random()::text),''),'hex') FROM generate_series(1,(n+15)/16) $$;
    CREATE TABLE public.sedes(id uuid PRIMARY KEY);
    CREATE TABLE public.cleaners(id uuid PRIMARY KEY,name text,is_active boolean DEFAULT true);
    CREATE TABLE public.stock_warehouses(id uuid PRIMARY KEY,sede_id uuid REFERENCES sedes,name text,is_active boolean DEFAULT true,location_type text DEFAULT 'central');
    CREATE TABLE public.stock_categories(id uuid PRIMARY KEY,kind text,is_active boolean DEFAULT true);
    CREATE TABLE public.stock_products(id uuid PRIMARY KEY,sede_id uuid REFERENCES sedes,category_id uuid REFERENCES stock_categories,is_active boolean DEFAULT true);
    CREATE TYPE public.stock_movement_type AS ENUM ('entrada','salida','ajuste','transferencia','consumo_automatico');
    CREATE TABLE public.stock_levels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid REFERENCES stock_products,warehouse_id uuid REFERENCES stock_warehouses,current_quantity numeric(12,2) NOT NULL DEFAULT 0 CHECK(current_quantity>=0),minimum_quantity numeric DEFAULT 0,target_quantity numeric DEFAULT 0,last_updated timestamptz DEFAULT now(),updated_by uuid,stock_version bigint DEFAULT 0,UNIQUE(product_id,warehouse_id));
    CREATE TABLE public.stock_movements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid REFERENCES stock_products,warehouse_id uuid REFERENCES stock_warehouses,movement_type stock_movement_type,quantity numeric CHECK(quantity>0),previous_quantity numeric,new_quantity numeric,reason text,created_at timestamptz DEFAULT now());
    CREATE TABLE public.laundry_route_workers(id uuid PRIMARY KEY,cleaner_id uuid REFERENCES cleaners,sede_id uuid REFERENCES sedes,is_active boolean DEFAULT true,pin_synced_at timestamptz DEFAULT now(),fixture_pin text);
    CREATE FUNCTION public.verify_laundry_route_worker_pin(_route_worker_id uuid,_pin text) RETURNS boolean LANGUAGE sql AS $$ SELECT fixture_pin=_pin FROM public.laundry_route_workers WHERE id=_route_worker_id AND is_active $$;
    CREATE FUNCTION public.increment_stock_level_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.stock_version:=OLD.stock_version+1; RETURN NEW; END $$;
    CREATE TRIGGER increment_stock_level_version BEFORE UPDATE ON stock_levels FOR EACH ROW EXECUTE FUNCTION increment_stock_level_version();
    GRANT USAGE ON SCHEMA public,extensions TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT USAGE ON TYPE public.stock_movement_type TO service_role;
    GRANT EXECUTE ON FUNCTION extensions.gen_random_bytes(integer),public.verify_laundry_route_worker_pin(uuid,text) TO service_role;
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261005164100_laundry_daily_receipts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const sede = randomUUID(),
    warehouse = randomUUID(),
    warehouse2 = randomUUID(),
    category = randomUUID(),
    worker = randomUUID(),
    worker2 = randomUUID();
  await db.query("INSERT INTO sedes VALUES ($1)", [sede]);
  await db.query(
    "INSERT INTO stock_warehouses(id,sede_id,name) VALUES($1,$3,'Almacén de prueba'),($2,$3,'Otro almacén')",
    [warehouse, warehouse2, sede],
  );
  await db.query("INSERT INTO stock_categories(id,kind) VALUES($1,'laundry')", [
    category,
  ]);
  const productMap = {};
  for (const key of materialKeys) {
    productMap[key] = randomUUID();
    await db.query(
      "INSERT INTO stock_products(id,sede_id,category_id) VALUES($1,$2,$3)",
      [productMap[key], sede, category],
    );
  }
  for (const [id, name, pin] of [
    [worker, "Empleado A", "1234"],
    [worker2, "Empleado B", "5678"],
  ]) {
    const cleaner = randomUUID();
    await db.query("INSERT INTO cleaners(id,name) VALUES($1,$2)", [
      cleaner,
      name,
    ]);
    await db.query(
      "INSERT INTO laundry_route_workers(id,cleaner_id,sede_id,fixture_pin) VALUES($1,$2,$3,$4)",
      [id, cleaner, sede, pin],
    );
  }
  const rpc = async (name, args = {}) => {
    const keys = Object.keys(args),
      values = Object.values(args);
    const params = keys.map((key, i) => `${key} => $${i + 1}`).join(",");
    return (
      await db.query(`SELECT public.${name}(${params}) AS result`, values)
    ).rows[0].result;
  };
  const config = await rpc("configure_laundry_receipt", {
    _warehouse: warehouse,
    _map: productMap,
    _workers: [worker, worker2],
    _active: true,
  });
  const sessionHash = "a".repeat(64),
    sessionHash2 = "b".repeat(64);
  await rpc("login_laundry_receipt", {
    _token: config.token,
    _pin: "1234",
    _ip_hash: "1".repeat(64),
    _session_hash: sessionHash,
  });
  await rpc("login_laundry_receipt", {
    _token: config.token,
    _pin: "5678",
    _ip_hash: "2".repeat(64),
    _session_hash: sessionHash2,
  });
  const date = (
    await db.query(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS date",
    )
  ).rows[0].date;
  const mutate = (payload, opts = {}) =>
    rpc("mutate_laundry_receipt", {
      _token: config.token,
      _session_hash: opts.session ?? sessionHash,
      _date: opts.date ?? date,
      _op_id: opts.id ?? randomUUID(),
      _payload: payload,
    });
  const state = (opts = {}) =>
    rpc("read_laundry_receipt", {
      _token: config.token,
      _session_hash: opts.session ?? sessionHash,
      _date: opts.date ?? date,
    });
  return {
    db,
    sede,
    rpc,
    config,
    worker,
    worker2,
    warehouse,
    warehouse2,
    productMap,
    sessionHash,
    sessionHash2,
    date,
    mutate,
    state,
  };
}
