import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contrato de la migración que cierra alertas de stock al ajustar. La lógica SQL se verificó
// además en un PostgreSQL desechable (ver la PR); aquí se protege lo que no debe cambiar.
const v1 = readFileSync('supabase/migrations/20261012190000_stock_adjust_atomic.sql', 'utf8');
const v2 = readFileSync('supabase/migrations/20261012210000_stock_adjust_close_alerts.sql', 'utf8');

// Solo reemplaza la función: sin DDL ni datos
assert.doesNotMatch(v2, /DROP |DELETE FROM|TRUNCATE|ALTER TABLE|CREATE TABLE|CREATE POLICY|CREATE TRIGGER|INSERT INTO public\.stock_alerts/i);
assert.equal((v2.match(/CREATE OR REPLACE FUNCTION/g) || []).length, 1);

// Misma firma, mismas garantías de v1
const signature = /CREATE OR REPLACE FUNCTION public\.adjust_stock_level\(\s*stock_level_id_param UUID,\s*movement_type_param TEXT,\s*quantity_param NUMERIC,\s*reason_param TEXT,\s*cost_per_unit_param NUMERIC DEFAULT NULL\s*\)/;
assert.match(v1, signature);
assert.match(v2, signature);
for (const [pattern, why] of [
  [/SECURITY DEFINER/, 'sigue siendo SECURITY DEFINER'],
  [/FOR UPDATE OF l/, 'sigue bloqueando la fila'],
  [/auth\.uid\(\)/, 'sigue usando la sesión real'],
  [/role IN \('admin', 'manager'\)/, 'sigue exigiendo admin o manager'],
  [/INSERT INTO public\.stock_movements/, 'sigue registrando el movimiento'],
  [/REVOKE ALL ON FUNCTION public\.adjust_stock_level\([^)]*\) FROM PUBLIC, anon/, 'sin acceso anónimo'],
  [/GRANT EXECUTE ON FUNCTION public\.adjust_stock_level\([^)]*\) TO authenticated, service_role/, 'mismos permisos'],
]) assert.match(v2, pattern, why);

// Ciclo de alertas: cierra las que ya no corresponden y abre la que sí
assert.match(v2, /UPDATE public\.stock_alerts\s+SET is_active = false, resolved_at = now\(\)/);
assert.match(v2, /WHEN new_quantity = 0 THEN 'stock_critico'/);
assert.match(v2, /WHEN new_quantity <= level_record\.minimum_quantity THEN 'stock_bajo'/);
assert.match(v2, /PERFORM public\.create_stock_alert_if_needed/);
// Solo toca las alertas del nivel ajustado
assert.match(v2, /WHERE stock_level_id = level_record\.id/);
// El cierre ocurre después de escribir stock y movimiento
assert.ok(v2.indexOf('INSERT INTO public.stock_movements') < v2.indexOf('UPDATE public.stock_alerts'));

console.log('PASS migración v2 de alertas: solo la función, mismas garantías y ciclo de alertas');
