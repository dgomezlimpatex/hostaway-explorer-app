import { canUseOperationalMode, getDefaultOperationalMode, getEffectiveRole } from '@/auth/operationalMode';
import { getRolePermissions } from '@/lib/rolePermissions';

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

  const supervisorPermissions = getRolePermissions('supervisor');
  assert.equal(supervisorPermissions.inventory.canView, false);
  assert.equal(supervisorPermissions.supervision.canView, true);
  assert.equal(supervisorPermissions.supervision.canCreate, true);
  assert.equal(supervisorPermissions.supervision.canEdit, true);
  assert.equal(supervisorPermissions.supervision.canDelete, false);
}
