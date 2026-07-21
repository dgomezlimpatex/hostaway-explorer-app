import { createPlanningNotificationProvider } from '../supabase/functions/_shared/planningNotificationProvider';
import type { PlanningBatchServerFlags } from '../supabase/functions/_shared/planningBatchFeatureFlags';

type Assert = typeof import('node:assert/strict');
const baseFlags: PlanningBatchServerFlags = {
  batchDispatchEnabled: false,
  transactionalApplyShadow: false,
  notificationsLive: false,
  whatsAppEnabled: false,
  emailEnabled: false,
  remindersEnabled: false,
  workerV2Enabled: false,
  providerMode: 'shadow',
};

export async function run(assert: Assert) {
  let credentialsRead = 0;
  let liveFactories = 0;
  const testDeliveries: string[] = [];
  const dependencies = {
    readCredentials: () => { credentialsRead += 1; return { token: 'never-expose' }; },
    createLiveProvider: () => { liveFactories += 1; return { deliver: async () => ({ outcome: 'accepted' as const }) }; },
    testProvider: { deliver: async (message: { id: string }) => { testDeliveries.push(message.id); return { outcome: 'accepted' as const }; } },
  };

  const shadow = createPlanningNotificationProvider(baseFlags, dependencies);
  assert.equal((await shadow.deliver({ id: 'shadow-1' })).outcome, 'shadowed');
  assert.equal(credentialsRead, 0);
  assert.equal(liveFactories, 0);

  const test = createPlanningNotificationProvider({ ...baseFlags, providerMode: 'test' }, dependencies);
  assert.equal((await test.deliver({ id: 'test-1' })).outcome, 'accepted');
  assert.deepEqual(testDeliveries, ['test-1']);
  assert.equal(credentialsRead, 0);
  assert.equal(liveFactories, 0);

  const liveFlags = { ...baseFlags, providerMode: 'live' as const, notificationsLive: true };
  const live = createPlanningNotificationProvider(liveFlags, dependencies);
  assert.equal(credentialsRead, 1);
  assert.equal(liveFactories, 1);
  assert.equal((await live.deliver({ id: 'live-1' })).outcome, 'accepted');
}
