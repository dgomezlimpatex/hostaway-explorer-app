import { canUseOperationalMode, getDefaultOperationalMode, getEffectiveRole } from '@/auth/operationalMode';

export function run(assert: typeof import('node:assert/strict')) {
  const dualRoles = ['supervisor', 'cleaner'] as const;

  assert.equal(getDefaultOperationalMode(dualRoles, 'supervisor'), 'supervision');
  assert.equal(canUseOperationalMode(dualRoles, 'supervision'), true);
  assert.equal(canUseOperationalMode(dualRoles, 'cleaning'), true);
  assert.equal(getEffectiveRole(dualRoles, 'supervisor', 'supervision'), 'supervisor');
  assert.equal(getEffectiveRole(dualRoles, 'supervisor', 'cleaning'), 'cleaner');

  assert.equal(getDefaultOperationalMode(['cleaner'], 'cleaner'), 'cleaning');
  assert.equal(canUseOperationalMode(['cleaner'], 'supervision'), false);
  assert.equal(canUseOperationalMode(['supervisor'], 'cleaning'), false);
  assert.equal(getEffectiveRole(['supervisor'], 'supervisor', 'cleaning'), 'supervisor');
}
