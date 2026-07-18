import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function run(assert: typeof import('node:assert/strict')) {
  const repoRoot = process.cwd();
  const read = (relativePath: string) => readFileSync(join(repoRoot, relativePath), 'utf8');

  const disabledHelper = read('supabase/functions/_shared/disabledIntegration.ts');
  assert.match(disabledHelper, /status:\s*410/);
  assert.match(disabledHelper, /HOSTAWAY_INTEGRATION_DISABLED/);

  for (const relativePath of [
    'supabase/functions/hostaway-sync/index.ts',
    'supabase/functions/hostaway-sync-with-retry/index.ts',
    'supabase/functions/manage-hostaway-cron/index.ts',
    'supabase/functions/setup-automation/index.ts',
    'supabase/functions/insert-properties/index.ts',
    'supabase/functions/send-sync-error-email/index.ts',
  ]) {
    assert.match(read(relativePath), /disabledHostawayResponse\(corsHeaders\)/);
  }

  const config = read('supabase/config.toml');
  for (const functionName of [
    'hostaway-sync',
    'hostaway-sync-with-retry',
    'manage-hostaway-cron',
    'setup-automation',
    'insert-properties',
    'send-sync-error-email',
  ]) {
    assert.match(config, new RegExp(`\\[functions\\.${functionName}\\]\\s+verify_jwt = true`));
  }

  const service = read('src/services/hostawaySync.ts');
  assert.match(service, /export const HOSTAWAY_INTEGRATION_ENABLED = false/);
  assert.match(service, /assertHostawayIntegrationEnabled/);
  assert.match(service, /La integración con Hostaway está desactivada/);
  assert.ok((service.match(/assertHostawayIntegrationEnabled\(\);/g) ?? []).length >= 9);

  const automationPage = read('src/pages/HostawayAutomation.tsx');
  assert.match(automationPage, /Integración desactivada/);
  assert.match(automationPage, /conservada para futuros clientes/);
  assert.doesNotMatch(automationPage, /useMutation|runSync\(|setupCronJobs\(|HostawayScheduleManager/);

  for (const relativePath of [
    'src/components/dashboard/DashboardSidebar.tsx',
    'src/components/dashboard/MobileDashboardSidebar.tsx',
  ]) {
    assert.doesNotMatch(read(relativePath), /title:\s*'Hostaway Sync'/);
  }

  const mainDashboard = read('src/components/dashboard/MainDashboard.tsx');
  assert.doesNotMatch(mainDashboard, /HostawayIntegrationWidget/);

  const migration = read('supabase/migrations/20260718162319_disable_dormant_hostaway.sql');
  assert.match(migration, /UPDATE public\.hostaway_sync_schedules[\s\S]*is_active = false/);
  assert.match(migration, /cron\.unschedule/);
  assert.match(migration, /jobname ILIKE 'hostaway%'/);
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.manage_hostaway_cron_job/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.list_hostaway_cron_jobs/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.delete_hostaway_cron_job/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM public\.hostaway_|TRUNCATE\s+(?:TABLE\s+)?public\./);
}
