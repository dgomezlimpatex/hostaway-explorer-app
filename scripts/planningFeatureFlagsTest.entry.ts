import { getPlanningBatchClientFlags } from '../src/services/planning/planningBatchFlags';
import {
  getPlanningBatchServerFlags,
  resolvePlanningProviderMode,
  shouldReadPlanningProviderCredentials,
} from '../supabase/functions/_shared/planningBatchFeatureFlags';

type Assert = typeof import('node:assert/strict');

export function run(assert: Assert) {
  assert.deepEqual(getPlanningBatchClientFlags({}), {
    readEnabled: false,
    writeEnabled: false,
  });
  assert.deepEqual(getPlanningBatchClientFlags({
    VITE_PLANNING_BATCH_V2_READ_ENABLED: 'true',
    VITE_PLANNING_BATCH_V2_WRITE_ENABLED: 'TRUE',
  }), {
    readEnabled: true,
    writeEnabled: true,
  });
  assert.equal(getPlanningBatchClientFlags({ VITE_PLANNING_BATCH_V2_WRITE_ENABLED: '1' }).writeEnabled, false);

  const emptyEnv = () => undefined;
  assert.deepEqual(getPlanningBatchServerFlags(emptyEnv), {
    batchDispatchEnabled: false,
    transactionalApplyShadow: false,
    notificationsLive: false,
    whatsAppEnabled: false,
    emailEnabled: false,
    remindersEnabled: false,
    workerV2Enabled: false,
    providerMode: 'shadow',
  });

  const testEnv = new Map<string, string>([
    ['WHATSAPP_BATCH_DISPATCH_ENABLED', 'true'],
    ['PLANNING_TRANSACTIONAL_APPLY_SHADOW', 'true'],
    ['PLANNING_PROVIDER_MODE', 'test'],
  ]);
  const testFlags = getPlanningBatchServerFlags((name) => testEnv.get(name));
  assert.equal(testFlags.batchDispatchEnabled, true);
  assert.equal(testFlags.transactionalApplyShadow, true);
  assert.equal(testFlags.providerMode, 'test');
  assert.equal(shouldReadPlanningProviderCredentials(testFlags), false);

  const unsafeLiveEnv = new Map<string, string>([['PLANNING_PROVIDER_MODE', 'live']]);
  assert.equal(getPlanningBatchServerFlags((name) => unsafeLiveEnv.get(name)).providerMode, 'shadow');

  const liveEnv = new Map<string, string>([
    ['PLANNING_PROVIDER_MODE', 'live'],
    ['PLANNING_NOTIFICATIONS_LIVE', 'true'],
    ['PLANNING_WHATSAPP_ENABLED', 'true'],
    ['PLANNING_EMAIL_DISPATCH_ENABLED', 'true'],
    ['PLANNING_REMINDERS_ENABLED', 'true'],
    ['PLANNING_WORKER_V2_ENABLED', 'true'],
  ]);
  const liveFlags = getPlanningBatchServerFlags((name) => liveEnv.get(name));
  assert.equal(liveFlags.providerMode, 'live');
  assert.equal(liveFlags.whatsAppEnabled, true);
  assert.equal(liveFlags.emailEnabled, true);
  assert.equal(liveFlags.remindersEnabled, true);
  assert.equal(liveFlags.workerV2Enabled, true);
  assert.equal(shouldReadPlanningProviderCredentials(liveFlags), true);

  assert.equal(resolvePlanningProviderMode('unknown', true), 'shadow');
  assert.equal(resolvePlanningProviderMode('live', false), 'shadow');
}
