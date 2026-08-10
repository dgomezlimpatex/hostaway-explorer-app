import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function run(assert: typeof import('node:assert/strict')) {
  const migrationPath = join(process.cwd(), 'supabase/migrations/20260810120000_budget_estimator_full_module.sql');
  let sql = '';
  try {
    sql = await readFile(migrationPath, 'utf8');
  } catch (error) {
    assert.fail(`No existe la migración del presupuestador: ${String(error)}`);
  }

  for (const table of [
    'budget_rate_profiles',
    'budget_rate_profile_versions',
    'tourist_budgets',
    'tourist_budget_versions',
    'tourist_budget_items',
    'tourist_budget_status_history',
    'tourist_budget_documents',
    'tourist_budget_activation_runs',
    'tourist_budget_activation_items',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table}\\b`), `falta ${table}`);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/, `falta RLS de ${table}`);
  }

  for (const fn of [
    'create_tourist_budget',
    'save_tourist_budget_version',
    'transition_tourist_budget',
    'activate_tourist_budget',
  ]) {
    assert.match(sql, new RegExp(`FUNCTION public\\.${fn}\\b`), `falta RPC ${fn}`);
    assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}`), `falta grant ${fn}`);
  }

  assert.match(sql, /tourist_budget_status/);
  assert.match(sql, /accepted/);
  assert.match(sql, /properties/);
  assert.match(sql, /duracion_servicio/);
  assert.match(sql, /coste_servicio/);
  assert.match(sql, /public\.has_role\(auth\.uid\(\), 'admin'::public\.app_role\)/);
}
