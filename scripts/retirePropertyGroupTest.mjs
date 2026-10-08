import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// In-memory PostgreSQL only. No Supabase client, credentials or network.
const db = new PGlite();
const group = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const user = '00000000-0000-0000-0000-000000000003';
const histories = ['supervision_work_items', 'supervision_reviews', 'supervision_routes', 'supervision_incidents', 'stock_warehouses', 'property_storage_access', 'auto_assignment_logs'];
try {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${user}'::uuid $$;
    CREATE FUNCTION public.user_is_admin_or_manager() RETURNS boolean LANGUAGE sql AS $$
      SELECT current_setting('test.manager', true) = 'yes'
    $$;
    CREATE TABLE property_groups(id uuid PRIMARY KEY, name text, is_active boolean, auto_assign_enabled boolean);
    CREATE TABLE properties(id int PRIMARY KEY);
    CREATE TABLE cleaners(id int PRIMARY KEY);
    CREATE TABLE property_group_assignments(id int PRIMARY KEY, property_group_id uuid REFERENCES property_groups ON DELETE CASCADE, property_id int UNIQUE REFERENCES properties);
    CREATE TABLE cleaner_group_assignments(id int PRIMARY KEY, property_group_id uuid REFERENCES property_groups ON DELETE CASCADE, cleaner_id int REFERENCES cleaners, is_active boolean, role_type text);
    INSERT INTO property_groups VALUES ('${group}', 'Edificio A', true, true), ('${other}', 'Edificio B', true, true);
    INSERT INTO properties VALUES (1), (2); INSERT INTO cleaners VALUES (1), (2);
    INSERT INTO property_group_assignments VALUES (1, '${group}', 1), (2, '${other}', 2);
    INSERT INTO cleaner_group_assignments VALUES (1, '${group}', 1, true, 'primary'), (2, '${group}', 2, false, 'excluded');
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  `);
  for (const table of ['property_groups', 'property_group_assignments', 'cleaner_group_assignments']) {
    await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY manager ON ${table} TO authenticated USING (user_is_admin_or_manager()) WITH CHECK (user_is_admin_or_manager());`);
  }
  for (const table of histories) {
    await db.exec(`CREATE TABLE ${table}(id int PRIMARY KEY, property_group_id uuid REFERENCES property_groups ON DELETE CASCADE, historical_value text); INSERT INTO ${table} VALUES (1, '${group}', 'completed history');`);
  }
  await db.exec(readFileSync('supabase/migrations/20261008120000_retire_property_group.sql', 'utf8'));
  const before = await db.query('SELECT * FROM property_groups ORDER BY id');
  assert.equal(before.rows[0].retired_at, null, 'Migration must not retire existing buildings');
  await db.exec('SET ROLE authenticated; SET test.manager = no;');
  await assert.rejects(db.query('SELECT retire_property_group($1)', [group]), /permiso/);
  await db.exec('SET test.manager = yes;');
  await assert.rejects(db.query('SELECT retire_property_group($1)', ['00000000-0000-0000-0000-000000000099']), /no existe/);
  // Force failure midway: the operation must preserve all rows and flags.
  await db.exec(`RESET ROLE; CREATE FUNCTION fail_removal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated failure'; END $$;
    CREATE TRIGGER fail_removal BEFORE DELETE ON cleaner_group_assignments FOR EACH ROW EXECUTE FUNCTION fail_removal(); SET ROLE authenticated;`);
  await assert.rejects(db.query('SELECT retire_property_group($1)', [group]), /simulated failure/);
  assert.deepEqual((await db.query('SELECT * FROM property_groups ORDER BY id')).rows, before.rows);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM property_group_assignments')).rows[0].n, 2);
  await db.exec('RESET ROLE; DROP TRIGGER fail_removal ON cleaner_group_assignments; SET ROLE authenticated;');
  await db.query('SELECT retire_property_group($1)', [group]);
  const retired = (await db.query('SELECT * FROM property_groups WHERE id=$1', [group])).rows[0];
  assert.equal(retired.is_active, false); assert.equal(retired.auto_assign_enabled, false); assert.ok(retired.retired_at);
  assert.equal(retired.retirement_snapshot.retired_by, user);
  assert.equal(retired.retirement_snapshot.properties.length, 1);
  assert.equal(retired.retirement_snapshot.team.length, 2);
  assert.equal(retired.retirement_snapshot.building.is_active, true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cleaner_group_assignments')).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM property_group_assignments')).rows[0].n, 1);
  await db.query('SELECT retire_property_group($1)', [group]);
  assert.deepEqual((await db.query('SELECT * FROM property_groups WHERE id=$1', [group])).rows[0], retired, 'Retry preserves original archive');
  for (const statement of [
    `INSERT INTO property_group_assignments VALUES (3, '${group}', 1)`,
    `INSERT INTO cleaner_group_assignments VALUES (3, '${group}', 1, true, 'primary')`,
    `UPDATE property_group_assignments SET property_group_id='${group}' WHERE id=2`,
    `UPDATE property_groups SET is_active=true WHERE id='${group}'`,
    `DELETE FROM property_groups WHERE id='${group}'`,
  ]) await assert.rejects(db.exec(statement), /retirado|disponible/);
  await db.exec(`INSERT INTO property_group_assignments VALUES (3, '${other}', 1); INSERT INTO cleaner_group_assignments VALUES (3, '${other}', 1, true, 'primary');`);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM properties')).rows[0].n, 2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM cleaners')).rows[0].n, 2);
  await db.exec('RESET ROLE');
  for (const table of histories) assert.deepEqual((await db.query(`SELECT * FROM ${table}`)).rows, [{id: 1, property_group_id: group, historical_value: 'completed history'}]);
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('SELECT public.retire_property_group($1)', [group]), /permission denied/);
  console.log('Retirement SQL: permissions, rollback, archive, idempotence, stale links, reassignment and historical data preservation passed.');
} finally { await db.close(); }
