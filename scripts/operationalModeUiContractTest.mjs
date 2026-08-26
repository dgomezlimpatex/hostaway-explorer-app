import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const switcher = read('src/components/auth/OperationalModeSwitcher.tsx');
const desktopSidebar = read('src/components/dashboard/DashboardSidebar.tsx');
const mobileSidebar = read('src/components/dashboard/MobileDashboardSidebar.tsx');
const roleNavigation = read('src/components/navigation/RoleBasedNavigation.tsx');
const cleanerDashboard = read('src/components/dashboard/CleanerDashboard.tsx');

assert.match(switcher, /canSwitchOperationalMode/);
assert.match(switcher, /setOperationalMode\(value\)/);
assert.match(switcher, /Supervisión/);
assert.match(switcher, /Limpieza/);
assert.match(desktopSidebar, /OperationalModeSwitcher/);
assert.match(desktopSidebar, /!isCollapsed/);
assert.match(mobileSidebar, /OperationalModeSwitcher/);
assert.match(roleNavigation, /md:hidden/);
assert.match(cleanerDashboard, /md:hidden/);

console.log('operational-mode-ui-contract-tests: OK');
