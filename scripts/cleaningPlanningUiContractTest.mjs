import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

const filters = read('src/components/cleaning-planning/PlanningFilters.tsx');
const taskCard = read('src/components/cleaning-planning/PlanningTaskCard.tsx');
const proposalPanel = read('src/components/cleaning-planning/AssignmentProposalPanel.tsx');
const planningPage = read('src/components/cleaning-planning/CleaningPlanningPage.tsx');
const alertsPanel = read('src/components/cleaning-planning/PlanningAlertsPanel.tsx');
const cleanerLoadTable = read('src/components/cleaning-planning/CleanerLoadTable.tsx');
const cleanerColumn = read('src/components/cleaning-planning/CleanerPlanningColumn.tsx');
const workerAvailability = read('src/components/cleaning-planning/WorkerAvailabilityPanel.tsx');
const roleNavigation = read('src/components/navigation/RoleBasedNavigation.tsx');
const dashboardSidebar = read('src/components/dashboard/DashboardSidebar.tsx');
const mobileSidebar = read('src/components/dashboard/MobileDashboardSidebar.tsx');
const copilotPanel = read('src/components/cleaning-planning/PlanningCopilotPanel.tsx');

assert.match(filters, /import \{ formatMadridDate \} from '@\/utils\/date';/, 'PlanningFilters must import formatMadridDate');
assert.match(filters, /value=\{formatMadridDate\(date\)\}/, 'date input must use formatMadridDate(date), not toISOString()');
assert.doesNotMatch(filters, /toISOString\(\)\.slice\(0, 10\)/, 'PlanningFilters must not use UTC toISOString date slicing');

for (const label of [
  'Día anterior',
  'Fecha de planificación',
  'Día siguiente',
  'Seleccionar sede operativa',
  'Buscar propiedad, edificio o dirección',
  'Filtrar tareas por estado',
  'Filtrar por zona',
  'Filtrar por limpiadora',
]) {
  assert.match(filters, new RegExp(`aria-label="${label}"`), `PlanningFilters missing aria-label: ${label}`);
}
assert.match(filters, /min-h-\[44px\]/, 'Planning filters must use touch targets of at least 44px');

assert.doesNotMatch(taskCard, /window\.confirm/, 'PlanningTaskCard must not use native window.confirm');
assert.match(taskCard, /AlertDialog/, 'PlanningTaskCard must use AlertDialog for critical assignment actions');
assert.match(taskCard, /aria-label=\{`Desasignar \$\{task\.property\}`\}/, 'Unassign icon button must expose an aria-label');
assert.match(taskCard, /min-h-\[44px\]/, 'PlanningTaskCard assignment controls must use touch targets of at least 44px');
assert.match(taskCard, /break-words/, 'PlanningTaskCard must allow long operational data to wrap instead of hard truncating everything');
assert.match(taskCard, /Disponibilidad real no validada en esta acción manual/, 'Manual assignment dialog must warn that proposal-engine rules are not fully validated');

assert.match(proposalPanel, /onApply: \(\) => Promise<void>;/, 'AssignmentProposalPanel onApply prop must be async');
assert.match(proposalPanel, /await onApply\(\)/, 'Proposal dialog must await applying before closing');
assert.match(proposalPanel, /Propuesta asistida de planificación/, 'Proposal title must avoid overclaiming verification');
assert.match(proposalPanel, /max-h-\[360px\].*overflow-y-auto/s, 'Proposal lists should have bounded height and internal scroll');
assert.match(proposalPanel, /displayStartTime.*displayEndTime/s, 'Proposal cards must show task time context');

assert.match(planningPage, /const handleSedeChange = \(sede: Sede\) => \{/, 'Planning page must reset invalid filters/proposal when sede changes');
assert.match(planningPage, /setFilters\(defaultFilters\)/, 'Changing sede must reset planning filters');
assert.match(planningPage, /onSedeChange=\{handleSedeChange\}/, 'PlanningFilters must use the sede-change wrapper');
assert.match(planningPage, /const handleRefresh = \(\) => \{/, 'Planning page must centralize refresh behavior');
assert.match(planningPage, /buildingDataQuery\.refetch\(\)/, 'Refresh must retry building/team data as well as planning data');
assert.match(planningPage, /const dayState = isLoading \? 'Cargando planificación'/, 'Header badge must not claim day is controlled while planning is loading');
assert.match(planningPage, /isLoading \? '—' : planning\.summary\.unassignedTasks/, 'Header metrics must show loading placeholders instead of zeroes');
assert.match(planningPage, /filteredCleanerDays\.length === 0 \?/, 'Cleaner columns section needs an actionable empty state when filters hide all workers');
assert.match(planningPage, /xl:max-h-\[calc\(100vh-2rem\)\] xl:overflow-y-auto/, 'Sticky side panels should be scrollable');
assert.match(planningPage, /PlanningCopilotPanel/, 'Planning page must embed the Hermes planning copilot panel');
assert.match(planningPage, /buildPlanningCopilotSnapshot/, 'Planning page must build an explicit copilot snapshot');
assert.match(planningPage, /visibleTasks: filteredTasks/, 'Copilot snapshot must use the visible filtered task subset');
assert.match(planningPage, /isTaskAssignedToCleaner\(task, filters\.cleanerId\)/, 'Cleaner filter must include multi-assigned tasks via task_assignments');
assert.match(planningPage, /buildProposalSignature\(proposal\.proposals\)/, 'Proposal apply must use shared batch signature builder');

assert.doesNotMatch(copilotPanel, /window\.confirm/, 'PlanningCopilotPanel must not use native window.confirm');
assert.match(copilotPanel, /Copiloto Hermes/, 'PlanningCopilotPanel must identify Hermes in planning');
assert.match(copilotPanel, /Propuestas sobre filtros visibles/, 'Copilot must communicate visible-filter scope');
assert.match(copilotPanel, /Confirmación humana obligatoria/, 'Copilot must communicate human confirmation requirement');

assert.match(alertsPanel, /summary\.overcapacityCleaners > 0[\s\S]*limpiadora\(s\) sobrecargada\(s\)/, 'Alerts panel must show an explicit overcapacity-cleaners badge');

assert.match(cleanerLoadTable, /<caption className="sr-only">/, 'CleanerLoadTable must include an accessible table caption');
assert.match(cleanerLoadTable, /scope="col"/, 'CleanerLoadTable headers must include scope="col"');
assert.match(cleanerLoadTable, /role="progressbar"/, 'CleanerLoadTable custom utilization bar must expose progressbar semantics');
assert.match(cleanerLoadTable, /aria-valuetext=\{`\$\{day\.utilizationPercent\}% utilizado/, 'CleanerLoadTable progressbar must expose text value');
assert.match(cleanerLoadTable, /aria-label="Tabla de carga desplazable horizontalmente"/, 'Scrollable load table must be named for assistive tech');

assert.match(cleanerColumn, /className="w-full min-w-0/, 'CleanerPlanningColumn must not force horizontal overflow on narrow screens');
assert.match(cleanerColumn, /aria-label=\{`Carga de \$\{day\.cleanerName\}`\}/, 'CleanerPlanningColumn progress must have an accessible name');
assert.match(workerAvailability, /aria-label=\{`Disponibilidad de \$\{row\.cleanerName\}`\}/, 'WorkerAvailabilityPanel progress must have an accessible name');

assert.match(roleNavigation, /hasPermission\('tasks', 'canEdit'\).*to="\/cleaning-planning"/s, 'RoleBasedNavigation must expose planning only to tasks/canEdit users');
assert.match(dashboardSidebar, /permission: 'tasks-edit'/, 'DashboardSidebar planning link must use tasks-edit permission');
assert.match(dashboardSidebar, /case 'tasks-edit': return hasRolePermission\('tasks', 'canEdit'\);/, 'DashboardSidebar tasks-edit permission must map to tasks/canEdit');
assert.match(dashboardSidebar, /title: 'Hermes planificación'[\s\S]*href: '\/cleaning-planning\?copilot=open'[\s\S]*permission: 'tasks-edit'/, 'Desktop sidebar must deep-link Hermes planning to /cleaning-planning?copilot=open');
assert.match(mobileSidebar, /title: 'Hermes planificación'[\s\S]*href: '\/cleaning-planning\?copilot=open'[\s\S]*permission: 'tasks-edit'/, 'Mobile sidebar must deep-link Hermes planning to /cleaning-planning?copilot=open');
assert.match(mobileSidebar, /case 'tasks-edit': return hasRolePermission\('tasks', 'canEdit'\);/, 'Mobile sidebar tasks-edit permission must map to tasks/canEdit');

console.log('cleaning-planning-ui-contract-tests: OK');
