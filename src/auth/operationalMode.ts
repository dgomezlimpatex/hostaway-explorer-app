export type OperationalMode = 'supervision' | 'cleaning';

const SUPERVISION_ROLES = new Set(['admin', 'manager', 'supervisor']);

export const canUseOperationalMode = (
  roles: readonly string[],
  mode: OperationalMode,
): boolean => {
  if (mode === 'cleaning') return roles.includes('cleaner');
  return roles.some((role) => SUPERVISION_ROLES.has(role));
};

export const getDefaultOperationalMode = (
  roles: readonly string[],
  primaryRole?: string | null,
): OperationalMode => {
  if (canUseOperationalMode(roles, 'supervision')) return 'supervision';
  if (canUseOperationalMode(roles, 'cleaning')) return 'cleaning';
  return primaryRole === 'cleaner' ? 'cleaning' : 'supervision';
};

export const getEffectiveRole = (
  roles: readonly string[],
  primaryRole: string | null,
  mode: OperationalMode,
): string | null => {
  if (mode === 'cleaning' && canUseOperationalMode(roles, 'cleaning')) return 'cleaner';
  if (mode === 'supervision' && roles.includes('admin')) return 'admin';
  if (mode === 'supervision' && roles.includes('manager')) return 'manager';
  if (mode === 'supervision' && roles.includes('supervisor')) return 'supervisor';
  return primaryRole || roles[0] || null;
};
