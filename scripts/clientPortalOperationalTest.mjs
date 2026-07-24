import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = process.cwd();
const outdir = mkdtempSync(join(tmpdir(), 'client-portal-operational-'));
const outfile = join(outdir, 'bundle.mjs');

await build({
  entryPoints: [join(repoRoot, 'scripts/clientPortalOperationalTest.entry.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: false,
  logLevel: 'silent',
});

try {
  const tests = await import(pathToFileURL(outfile).href);
  await tests.run(assert);

  const operationalStatusMigration = join(
    repoRoot,
    'supabase/migrations/20260724114500_add_client_portal_operational_statuses.sql',
  );
  assert.equal(
    existsSync(operationalStatusMigration),
    true,
    'the portal needs a database migration exposing a minimal operational status projection',
  );
  const migrationSql = readFileSync(operationalStatusMigration, 'utf8');
  assert.match(migrationSql, /get_client_portal_operational_statuses/i);
  assert.match(migrationSql, /RETURNS TABLE\s*\(\s*task_id uuid,\s*operational_status text\s*\)/i);
  assert.match(migrationSql, /report\.overall_status = 'in_progress'/i);
  assert.match(migrationSql, /task\.cliente_id = _client_id/i);
  assert.match(migrationSql, /operational_portal_enabled = true/i);
  assert.doesNotMatch(
    migrationSql,
    /UPDATE\s+public\.tasks|CREATE\s+TRIGGER/i,
    'the portal projection must never mutate operational tasks or invoke planning guards',
  );
  assert.match(migrationSql, /GRANT EXECUTE[\s\S]*TO anon, authenticated/i);

  const detailModalSource = readFileSync(
    join(repoRoot, 'src/components/client-portal/ReservationDetailModal.tsx'),
    'utf8',
  );
  assert.match(
    detailModalSource,
    /getPortalOperationalStatus\(booking\.taskStatus\)/,
    'the detail modal must use the same real task-status normalization as the operational card',
  );

  const portalHookSource = readFileSync(join(repoRoot, 'src/hooks/useClientPortal.ts'), 'utf8');
  assert.match(
    portalHookSource,
    /\.rpc\('get_client_portal_operational_statuses'/,
    'the public booking hook must enrich task status from the minimal server projection',
  );
  assert.match(
    portalHookSource,
    /\.from\('task_reports'\)[\s\S]*?\.eq\('task_id', taskId\)[\s\S]*?\.eq\('overall_status', 'completed'\)/,
    'the public portal must not load report photos before the report is completed',
  );
  console.log('client-portal-operational-tests: OK');
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
