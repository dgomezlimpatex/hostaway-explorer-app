import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contrato de la migración que devuelve el permiso a las funciones de stock que usa la app.
// La lógica SQL se verificó además en un PostgreSQL desechable (ver la PR); aquí se protege
// lo que no debe cambiar: la comprobación contra la sesión y los permisos.
// Sin comentarios: las reglas se comprueban sobre sentencias, no sobre la explicación de la cabecera
const sql = readFileSync('supabase/migrations/20261013100000_stock_functions_session_grants.sql', 'utf8')
  .split(/\r?\n/).filter(line => !line.trimStart().startsWith('--')).join('\n');

const signatures = [
  'transfer_stock_between_warehouses\\(UUID, UUID, UUID, NUMERIC, TEXT, UUID\\)',
  'update_stock_level_settings\\(UUID, NUMERIC, NUMERIC, NUMERIC, UUID\\)',
  'create_stock_warehouse\\(UUID, TEXT, TEXT, BOOLEAN, INTEGER\\)',
  'set_default_stock_warehouse\\(UUID\\)',
];
for (const signature of signatures) {
  assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature} FROM PUBLIC, anon;`), `sin acceso anónimo: ${signature}`);
  assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${signature} TO authenticated, service_role;`), `permiso para sesión y servicio: ${signature}`);
}
assert.doesNotMatch(sql, /GRANT[^;]*\banon\b/, 'nada se concede a anon');
assert.doesNotMatch(sql, /GRANT[^;]*\bPUBLIC\b/, 'nada se concede a PUBLIC');

// El consumo antiguo sigue sin permiso: el consumo automático ya corre en el servidor (cron)
assert.doesNotMatch(sql, /GRANT[^;]*process_stock_consumption_for_task/i);
assert.doesNotMatch(sql, /process_stock_consumption_for_task\s*\(/i, 'no redefine la función de consumo');

// Solo se redefinen las dos funciones que confiaban en el user_id del navegador
const definitions = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g)].map(match => match[1]);
assert.deepEqual(definitions, ['transfer_stock_between_warehouses', 'update_stock_level_settings']);
assert.doesNotMatch(sql, /DROP |DELETE FROM|TRUNCATE|ALTER TABLE|CREATE TABLE|CREATE POLICY|CREATE TRIGGER/i, 'sin DDL ni datos');

// Cada una exige que el usuario enviado coincida con la sesión, antes de leer o escribir nada
const guard = /IF auth\.uid\(\) IS NOT NULL AND auth\.uid\(\) <> user_id_param THEN\s+RAISE EXCEPTION 'User does not match the authenticated session';/;
for (const name of definitions) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = sql.indexOf('$function$;', start + 10);
  const body = sql.slice(start, end);
  assert.match(body, guard, `${name} exige que el usuario coincida con la sesión`);
  assert.ok(body.search(guard) < body.search(/UPDATE public\.stock_levels|INSERT INTO public\.stock_levels|SELECT \* INTO from_stock/), `${name}: la comprobación va antes de tocar datos`);
  assert.match(body, /SECURITY DEFINER/);
  assert.match(body, /FROM public\.user_roles\s+WHERE user_id = user_id_param\s+AND role IN \('admin', 'manager'\)/, `${name} conserva la comprobación de rol`);
}
assert.match(sql, /FOR UPDATE/, 'la transferencia conserva el bloqueo de filas');

console.log('PASS permisos de funciones de stock: sesión obligatoria, sin acceso anónimo y sin DDL');
