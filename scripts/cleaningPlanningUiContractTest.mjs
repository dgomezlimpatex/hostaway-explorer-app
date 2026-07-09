import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

const appRoutes = read('src/App.tsx');
const filters = read('src/components/cleaning-planning/PlanningFilters.tsx');
const taskCard = read('src/components/cleaning-planning/PlanningTaskCard.tsx');
const proposalPanel = read('src/components/cleaning-planning/AssignmentProposalPanel.tsx');
const proposalCalendar = read('src/components/cleaning-planning/PlanningProposalCalendar.tsx');
const planningPage = read('src/components/cleaning-planning/CleaningPlanningPage.tsx');
const workflowGuide = read('src/components/cleaning-planning/PlanningWorkflowGuide.tsx');
const alertsPanel = read('src/components/cleaning-planning/PlanningAlertsPanel.tsx');
const cleanerLoadTable = read('src/components/cleaning-planning/CleanerLoadTable.tsx');
const cleanerColumn = read('src/components/cleaning-planning/CleanerPlanningColumn.tsx');
const workerAvailability = read('src/components/cleaning-planning/WorkerAvailabilityPanel.tsx');
const roleNavigation = read('src/components/navigation/RoleBasedNavigation.tsx');
const dashboardSidebar = read('src/components/dashboard/DashboardSidebar.tsx');
const mobileSidebar = read('src/components/dashboard/MobileDashboardSidebar.tsx');
const copilotPanel = read('src/components/cleaning-planning/PlanningCopilotPanel.tsx');
const dailyHeader = read('src/components/cleaning-planning/DailyPlanningHeader.tsx');
const attentionSummary = read('src/components/cleaning-planning/PlanningAttentionSummary.tsx');
const decisionQueue = read('src/components/cleaning-planning/PlanningDecisionQueue.tsx');
const advancedDetails = read('src/components/cleaning-planning/PlanningAdvancedDetails.tsx');
const operationalPlanning = read('src/components/planning/OperationalPlanningPage.tsx');
const capacityUtils = read('src/utils/cleaning-planning/capacity.ts');
const propertyGroupTypes = read('src/types/propertyGroups.ts');
const buildingDataHook = read('src/hooks/useCleaningPlanningBuildingData.ts');
const operationalPlanningService = read('src/services/planning/operationalPlanningService.ts');

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
assert.match(filters, /Más filtros/, 'PlanningFilters must keep advanced filters collapsed behind “Más filtros”');
assert.match(filters, /Limpiar filtros/, 'PlanningFilters must offer a simple way to clear advanced filters');
assert.match(filters, /showAdvancedFilters/, 'PlanningFilters must not show all filters by default');
assert.match(filters, /min-h-\[44px\]/, 'Planning filters must use touch targets of at least 44px');

assert.doesNotMatch(taskCard, /window\.confirm/, 'PlanningTaskCard must not use native window.confirm');
assert.match(taskCard, /AlertDialog/, 'PlanningTaskCard must use AlertDialog for critical assignment actions');
assert.match(taskCard, /aria-label=\{`Desasignar \$\{task\.property\}`\}/, 'Unassign icon button must expose an aria-label');
assert.match(taskCard, /min-h-\[44px\]/, 'PlanningTaskCard assignment controls must use touch targets of at least 44px');
assert.match(taskCard, /break-words/, 'PlanningTaskCard must allow long operational data to wrap instead of hard truncating everything');
assert.match(taskCard, /Disponibilidad real no validada en esta acción manual/, 'Manual assignment dialog must warn that proposal-engine rules are not fully validated');
assert.match(taskCard, /variant\?: 'simple' \| 'detailed'/, 'PlanningTaskCard must expose a simple variant for the daily decision queue');
assert.match(taskCard, /Sin responsable/, 'Simple task cards must use operational wording for unassigned work');

assert.match(dailyHeader, /Planificación diaria de limpiezas/, 'Daily header must use operational wording');
assert.match(dailyHeader, /Planificar con Hermes/, 'Daily header must expose the single primary planning CTA');
assert.doesNotMatch(`${copilotPanel}\n${proposalPanel}`, /Planificar con Hermes/, 'Hermes/proposal panels must not duplicate the primary planning CTA');
assert.match(dailyHeader, /Sin cubrir[\s\S]*Requiere decisión[\s\S]*Capacidad/, 'Daily header must limit primary metrics to the operational three');
assert.doesNotMatch(dailyHeader, /Planificación V2|legacy|MVP|fallback/, 'Daily header must not expose technical rollout jargon');

assert.match(attentionSummary, /Qué necesita atención/, 'PlanningAttentionSummary must frame issues as operational attention');
assert.match(attentionSummary, /Todo lo visible está cubierto/, 'Attention summary must have a calm all-clear state');
assert.match(attentionSummary, /slice\(0, 5\)/, 'Attention summary should cap bullets to avoid information overload');

assert.match(decisionQueue, /Decisiones pendientes/, 'PlanningDecisionQueue must be the main task list');
assert.match(decisionQueue, /Urgente: entradas tempranas[\s\S]*Sin cubrir[\s\S]*Casas grandes[\s\S]*Requieren revisión/, 'Decision queue must prioritize operational groups');
assert.match(decisionQueue, /variant="simple"/, 'Decision queue must use simple task cards');
assert.match(decisionQueue, /<details className=/, 'Already-covered tasks should be collapsed by default');

assert.match(advancedDetails, /Ver disponibilidad, carga y diagnóstico técnico/, 'Technical panels must live behind advanced details');
assert.match(planningPage, /DailyPlanningHeader/, 'Planning page must use the simplified daily header');
assert.match(planningPage, /PlanningWorkflowGuide/, 'Planning page must show a simple 3-step workflow guide');
assert.match(workflowGuide, /Cierra el plan en 3 pasos/, 'Workflow guide must explain the daily planning sequence');
assert.match(workflowGuide, /Personalizar edificios/, 'Workflow guide must expose building personalization from planning');
assert.match(workflowGuide, /to="\/planning\/buildings"/, 'Workflow guide must link to operational buildings index');
assert.match(workflowGuide, /Define propiedades, duración, titulares, suplentes, backups y “No apta”/, 'Workflow guide must explain building customization inputs');
assert.match(planningPage, /PlanningAttentionSummary/, 'Planning page must show an operational attention summary');
assert.match(planningPage, /PlanningDecisionQueue/, 'Planning page must show a single decision queue');
assert.match(planningPage, /PlanningAdvancedDetails[\s\S]*WorkerAvailabilityPanel[\s\S]*CleanerLoadTable[\s\S]*BuildingTaskBoard/s, 'Availability/load/building technical panels must be inside advanced details');
assert.doesNotMatch(planningPage, /PlanningSummaryCards/, 'The simplified default view must not render duplicated summary-card KPIs');
assert.doesNotMatch(`${planningPage}\n${dailyHeader}\n${copilotPanel}\n${proposalPanel}\n${alertsPanel}`, /Planificación V2|legacy|MVP|fallback/, 'Primary planning UI must not expose technical rollout jargon');

assert.match(proposalPanel, /onApply: \(draftProposals: AssignmentProposal\[\]\) => Promise<void>;/, 'AssignmentProposalPanel onApply prop must accept the reviewed draft and be async');
assert.match(proposalPanel, /await onApply\(draftProposals\)/, 'Proposal dialog must await applying the edited draft before closing');
assert.match(proposalPanel, /Plan recomendado/, 'Proposal title must be operational and consistent with Hermes');
assert.doesNotMatch(proposalPanel, /Proponer asignación/, 'Proposal panel must not compete with the primary Hermes planning CTA');
assert.match(proposalPanel, /groupProposalsByTask/, 'Proposal panel must group multi-cleaner proposals by task');
assert.match(proposalPanel, /por persona/, 'Grouped multi-cleaner proposals must explain per-person duration');
assert.doesNotMatch(proposalPanel, /max-h-\[360px\][\s\S]*overflow-y-auto/, 'Ready proposal list must not be trapped in a small internal scroll area');
assert.doesNotMatch(proposalPanel, /max-h-\[260px\][\s\S]*overflow-y-auto/, 'Decision-needed list must not be trapped in a small internal scroll area');
assert.match(proposalPanel, /grid gap-3 lg:grid-cols-2 2xl:grid-cols-3/, 'Proposal and decision lists must use a wide responsive grid');
assert.match(proposalPanel, /Necesitan decisión manual/, 'Decision-needed section must be explicit and prominent');
assert.match(proposalPanel, /displayStartTime.*displayEndTime/s, 'Proposal cards must show task time context');
assert.match(proposalPanel, /Horario propuesto/, 'Proposal cards must show the sequenced operational time when Hermes packs same-building tasks');
assert.match(proposalPanel, /Calidad operativa del plan/, 'Proposal panel must show whole-plan operational quality, not only individual task cards');
assert.match(proposalPanel, /centros completos[\s\S]*centros divididos[\s\S]*divisiones evitables[\s\S]*backups usados/s, 'Whole-plan quality must expose centre continuity and backup metrics');
assert.match(proposalPanel, /Alertas críticas del plan/, 'Proposal panel must surface critical warnings as an explicit devil-advocate section');
assert.match(proposalPanel, /PlanningProposalCalendar/, 'Proposal panel must embed the sandbox calendar view for recommended plans');
assert.match(proposalPanel, /viewMode.*calendar.*list.*conflicts/s, 'Proposal panel must offer Calendar/List/Conflicts review modes');
assert.match(proposalPanel, /onApply\(draftProposals\)/, 'Confirming the proposal must apply the edited draft, not the original unreviewed proposal');
assert.match(proposalPanel, /draftBlockingWarnings\.length === 0/, 'Proposal apply must be blocked while the calendar draft has blocking warnings');
assert.match(proposalPanel, /setDraftProposals\(proposal\?\.proposals \|\| \[\]\)/, 'Draft proposal state must reset when Hermes generates or clears a proposal');

assert.match(proposalCalendar, /Plan calendario editable/, 'PlanningProposalCalendar must name the visual sandbox clearly');
assert.match(proposalCalendar, /No guarda nada hasta confirmar/, 'PlanningProposalCalendar must explain that edits are not persisted yet');
assert.match(proposalCalendar, /Cambiar responsable/, 'Calendar cards must allow responsible-person edits in the draft');
assert.match(proposalCalendar, /Cambios pendientes/, 'Calendar must summarize manual draft changes');
assert.match(proposalCalendar, /Solape de horario/, 'Calendar must detect and expose draft overlaps');
assert.match(proposalCalendar, /No apta para este edificio/, 'Calendar must block explicit No apta draft assignments');
assert.match(proposalCalendar, /Fuera del equipo habitual/, 'Calendar must warn when a manual assignment leaves the building team');
assert.match(proposalCalendar, /resetDraft/, 'Calendar must allow resetting manual edits back to Hermes proposal');
assert.doesNotMatch(proposalCalendar, /taskStorageService|multipleTaskAssignmentService|supabase\.from/, 'PlanningProposalCalendar must be a local sandbox and must not persist changes directly');

assert.match(planningPage, /const handleSedeChange = \(sede: Sede\) => \{/, 'Planning page must reset invalid filters/proposal when sede changes');
assert.match(planningPage, /setFilters\(defaultFilters\)/, 'Changing sede must reset planning filters');
assert.match(planningPage, /onSedeChange=\{handleSedeChange\}/, 'PlanningFilters must use the sede-change wrapper');
assert.match(planningPage, /const handleRefresh = \(\) => \{/, 'Planning page must centralize refresh behavior');
assert.match(planningPage, /buildingDataQuery\.refetch\(\)/, 'Refresh must retry building/team data as well as planning data');
assert.match(planningPage, /isLoading \? '—' : planning\.summary\.unassignedTasks/, 'Header metrics must show loading placeholders instead of zeroes');
assert.match(planningPage, /filteredCleanerDays\.length === 0 \?/, 'Detailed cleaner section needs an actionable empty state when filters hide all workers');
assert.doesNotMatch(planningPage, /xl:max-h-\[calc\(100vh-2rem\)\] xl:overflow-y-auto/, 'Planning page must not create nested scrolling in the right rail');
assert.match(planningPage, /<AssignmentProposalPanel[\s\S]*<PlanningDecisionQueue/s, 'Plan recomendado must be a wide main-section before the decision queue, not inside the narrow Hermes rail');
assert.match(planningPage, /calendarTasks=\{filteredTasks\}/, 'Proposal calendar must receive all visible tasks so existing assignments and proposed work are seen together');
assert.match(planningPage, /cleaners=\{operationalCleaners\}/, 'Proposal calendar must receive operational cleaners for responsible-person edits');
assert.match(planningPage, /excludedCleanerAssignments=\{buildingData\.excludedCleanerAssignments\}/, 'Proposal calendar must receive No apta assignments for blocking warnings');
assert.match(planningPage, /PlanningCopilotPanel/, 'Planning page must embed the Hermes planning copilot panel');
assert.match(planningPage, /buildPlanningCopilotSnapshot/, 'Planning page must build an explicit copilot snapshot');
assert.match(planningPage, /visibleTasks: filteredTasks/, 'Copilot snapshot must use the visible filtered task subset');
assert.match(planningPage, /isTaskAssignedToCleaner\(task, filters\.cleanerId\)/, 'Cleaner filter must include multi-assigned tasks via task_assignments');
assert.match(planningPage, /buildProposalSignature\(proposalsToApply\)/, 'Proposal apply must use shared batch signature builder over the reviewed draft');

assert.doesNotMatch(copilotPanel, /window\.confirm/, 'PlanningCopilotPanel must not use native window.confirm');
assert.match(copilotPanel, /Hermes te ayuda a cerrar el día/, 'PlanningCopilotPanel must be action-first and operational');
assert.match(copilotPanel, /Planifica esta vista/, 'Copilot must communicate current-view scope without technical jargon');
assert.match(copilotPanel, /tú confirmas antes de guardar y notificar/i, 'Copilot must communicate human confirmation requirement');
assert.match(copilotPanel, /Añadir instrucción o ver conversación avanzada/, 'Free-form chat/history must be advanced, not the default focus');

assert.match(alertsPanel, /summary\.overcapacityCleaners > 0[\s\S]*limpiadora\(s\) sobrecargada\(s\)/, 'Alerts panel must show an explicit overcapacity-cleaners badge');

assert.match(cleanerLoadTable, /<caption className="sr-only">/, 'CleanerLoadTable must include an accessible table caption');
assert.match(cleanerLoadTable, /scope="col"/, 'CleanerLoadTable headers must include scope="col"');
assert.match(cleanerLoadTable, /role="progressbar"/, 'CleanerLoadTable custom utilization bar must expose progressbar semantics');
assert.match(cleanerLoadTable, /aria-valuetext=\{`\$\{day\.utilizationPercent\}% utilizado/, 'CleanerLoadTable progressbar must expose text value');
assert.match(cleanerLoadTable, /aria-label="Tabla de carga desplazable horizontalmente"/, 'Scrollable load table must be named for assistive tech');

assert.match(cleanerColumn, /className="w-full min-w-0/, 'CleanerPlanningColumn must not force horizontal overflow on narrow screens');
assert.match(cleanerColumn, /aria-label=\{`Carga de \$\{day\.cleanerName\}`\}/, 'CleanerPlanningColumn progress must have an accessible name');
assert.match(workerAvailability, /aria-label=\{`Disponibilidad de \$\{row\.cleanerName\}`\}/, 'WorkerAvailabilityPanel progress must have an accessible name');
assert.doesNotMatch(workerAvailability, />fallback</, 'WorkerAvailabilityPanel must not expose fallback jargon in visible text');

assert.match(appRoutes, /path="\/planning"[\s\S]*requiredModule="tasks" requiredAction="canEdit"[\s\S]*<CleaningPlanning \/>/, 'Official planning route must be /planning with the Hermes cleaning-planning cockpit');
assert.match(appRoutes, /path="\/cleaning-planning"[\s\S]*<CleaningPlanningRedirect \/>/, 'Legacy /cleaning-planning route must redirect to /planning preserving query string');
assert.match(appRoutes, /path="\/planning-settings"[\s\S]*<PlanningPage \/>/, 'Old operational planning/settings screen must remain available at /planning-settings');
assert.match(operationalPlanning, /<SelectItem value="excluded">No apta<\/SelectItem>/, 'Planning settings must expose “No apta” for workers excluded from a building');
assert.match(operationalPlanning, /isActive: roleToAssign !== 'excluded'/, 'No apta workers must be saved inactive so the proposal engine cannot use them');
assert.match(operationalPlanning, /onValueChange=\{\(value: CoverageRole\)/, 'Existing building coverage role selector must also support No apta');
assert.match(operationalPlanning, /updates: \{[\s\S]*roleType: value,[\s\S]*isActive: value !== 'excluded'/, 'Changing an existing worker to No apta must deactivate that building assignment');
assert.match(propertyGroupTypes, /roleType\?: 'primary' \| 'secondary' \| 'backup' \| 'excluded'/, 'Shared cleaner-group assignment type must include excluded');
assert.match(buildingDataHook, /cleaner_group_assignments'\)\.select\('\*'\)\.eq\('is_active', true\)/, 'Cleaning-planning proposal data must only load active building workers, excluding No apta records');
assert.match(capacityUtils, /source: 'property' \| 'missing'/, 'Planning duration source must be property estimate or missing only');
assert.doesNotMatch(capacityUtils, /source: 'task'|source: 'time_window'/, 'Planning must not estimate workload from task duration or time-window fallback');
assert.match(capacityUtils, /return \{ minutes: 0, source: 'missing' \};/, 'Tasks without property estimated hours must be flagged as missing duration');
assert.doesNotMatch(operationalPlanning, /Puede asumir carga de lencer[ií]a|bolsas pesadas/i, 'Planning UI must not treat linen/bag logistics as a worker planning criterion');
assert.doesNotMatch(operationalPlanning, /\bMVP\b|Planificación V2|>fallback</, 'Planning settings UI must not expose rollout jargon');
assert.doesNotMatch(operationalPlanningService, /planningRequiresLinenLoad && source\.cleaner\.planningCanHandleLinenLoad === false/, 'Planning service must not reject workers based on linen logistics');
assert.match(roleNavigation, /hasPermission\('tasks', 'canEdit'\).*to="\/planning"/s, 'RoleBasedNavigation must expose official planning at /planning only to tasks/canEdit users');
assert.match(roleNavigation, /to="\/planning-settings"[\s\S]*Ajustes de planificación/, 'RoleBasedNavigation must preserve the old planning configuration screen under /planning-settings');
assert.match(dashboardSidebar, /permission: 'tasks-edit'/, 'DashboardSidebar planning link must use tasks-edit permission');
assert.match(dashboardSidebar, /case 'tasks-edit': return hasRolePermission\('tasks', 'canEdit'\);/, 'DashboardSidebar tasks-edit permission must map to tasks/canEdit');
assert.match(dashboardSidebar, /title: 'Hermes planificación'[\s\S]*href: '\/planning\?copilot=open'[\s\S]*permission: 'tasks-edit'/, 'Desktop sidebar must keep a single Hermes planning shortcut');
assert.doesNotMatch(dashboardSidebar, /title: 'Planificación'[\s\S]*href: '\/planning'[\s\S]*permission: 'tasks-edit'/, 'Desktop sidebar must not show the generic planning shortcut alongside Hermes');
assert.doesNotMatch(dashboardSidebar, /title: 'Ajustes de planificación'[\s\S]*href: '\/planning-settings'[\s\S]*permission: 'propertyGroups'/, 'Desktop sidebar must not show planning settings as a daily shortcut');
assert.match(mobileSidebar, /title: 'Hermes planificación'[\s\S]*href: '\/planning\?copilot=open'[\s\S]*permission: 'tasks-edit'/, 'Mobile sidebar must keep a single Hermes planning shortcut');
assert.doesNotMatch(mobileSidebar, /title: 'Planificación'[\s\S]*href: '\/planning'[\s\S]*permission: 'tasks-edit'/, 'Mobile sidebar must not show the generic planning shortcut alongside Hermes');
assert.doesNotMatch(mobileSidebar, /title: 'Ajustes de planificación'[\s\S]*href: '\/planning-settings'[\s\S]*permission: 'propertyGroups'/, 'Mobile sidebar must not show planning settings as a daily shortcut');
assert.match(mobileSidebar, /case 'tasks-edit': return hasRolePermission\('tasks', 'canEdit'\);/, 'Mobile sidebar tasks-edit permission must map to tasks/canEdit');

console.log('cleaning-planning-ui-contract-tests: OK');
