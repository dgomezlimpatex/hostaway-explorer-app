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
const planningStart = read('src/components/cleaning-planning/PlanningStartScreen.tsx');
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
assert.match(planningStart, /¿Qué día quieres planificar\?/, 'Start screen must use direct operational wording');
assert.match(planningStart, /Preparar reparto con Hermes/, 'Start screen must expose the single primary planning CTA');
assert.doesNotMatch(`${copilotPanel}
${proposalPanel}`, /Planificar con Hermes/, 'Advanced/proposal panels must not duplicate the primary planning CTA');
assert.match(planningStart, /Opciones avanzadas/, 'Non-daily controls must stay behind progressive disclosure');
assert.doesNotMatch(planningStart, /Planificación V2|legacy|MVP|fallback|score/i, 'Start screen must not expose technical rollout or scoring jargon');

assert.match(attentionSummary, /Qué necesita atención/, 'PlanningAttentionSummary must frame issues as operational attention');
assert.match(attentionSummary, /Todo lo visible está cubierto/, 'Attention summary must have a calm all-clear state');
assert.match(attentionSummary, /slice\(0, 5\)/, 'Attention summary should cap bullets to avoid information overload');

assert.match(decisionQueue, /Decisiones pendientes/, 'PlanningDecisionQueue must be the main task list');
assert.match(decisionQueue, /Urgente: entradas tempranas[\s\S]*Sin cubrir[\s\S]*Casas grandes[\s\S]*Requieren revisión/, 'Decision queue must prioritize operational groups');
assert.match(decisionQueue, /variant="simple"/, 'Decision queue must use simple task cards');
assert.match(decisionQueue, /<details className=/, 'Already-covered tasks should be collapsed by default');

assert.match(advancedDetails, /Ver disponibilidad, carga y diagnóstico técnico/, 'Technical panels must live behind advanced details');
assert.match(planningPage, /PlanningStartScreen/, 'Planning page must use the radical-simple start screen');
assert.match(planningPage, /proposalState\s*\?\s*\(/, 'Proposal review must replace the start screen rather than stack below it');
assert.match(workflowGuide, /Personalizar edificios/, 'Advanced workflow guide must preserve building personalization');
assert.match(workflowGuide, /to="\/planning\/buildings"/, 'Advanced workflow guide must link to operational buildings index');
assert.match(planningPage, /PlanningAttentionSummary/, 'Planning page must preserve the attention summary inside advanced content');
assert.match(planningPage, /PlanningDecisionQueue/, 'Planning page must preserve the manual decision queue inside advanced content');
assert.match(planningPage, /PlanningAdvancedDetails[\s\S]*WorkerAvailabilityPanel[\s\S]*CleanerLoadTable[\s\S]*BuildingTaskBoard/s, 'Availability/load/building technical panels must remain inside advanced details');
assert.doesNotMatch(planningPage, /PlanningSummaryCards/, 'The simplified default view must not render duplicated summary-card KPIs');
assert.doesNotMatch(`${planningPage}\n${planningStart}\n${copilotPanel}\n${proposalPanel}\n${alertsPanel}`, /Planificación V2|legacy|MVP|fallback/, 'Primary planning UI must not expose technical rollout jargon');

assert.match(proposalPanel, /onApply: \(draftProposals: AssignmentProposal\[\]\) => Promise<void>;/, 'AssignmentProposalPanel onApply prop must accept the reviewed draft and be async');
assert.match(proposalPanel, /await onApply\(completeDraftProposals\)/, 'Direct save must await applying only complete task groups from the edited draft');
assert.match(proposalPanel, /Propuesta de Hermes/, 'Proposal title must be operational and consistent with Hermes');
assert.doesNotMatch(proposalPanel, /Proponer asignación|Confirmar y guardar|Revisar y confirmar/, 'Proposal panel must not duplicate planning or add a second confirmation');
assert.match(proposalPanel, /PlanningProposalCalendar/, 'Proposal panel must embed the editable calendar');
assert.match(proposalPanel, /Ver detalles del plan/, 'Quality and explanation must stay available on demand');
assert.match(proposalPanel, /globalQuality\?\.globalScore/, 'Whole-plan quality must remain available in details');
assert.match(proposalPanel, /Guardar reparto y avisar/, 'Proposal review must expose one-step final save');
assert.match(proposalPanel, /Descartar propuesta/, 'Proposal review must expose explicit discard');
assert.match(proposalPanel, /applyInFlightRef/, 'Direct approval must guard synchronously against double submission');
assert.match(proposalPanel, /sessionStorage/, 'Draft edits must autosave locally without persisting operational data');
assert.match(proposalPanel, /blockingWarnings\.length === 0/, 'Proposal apply must be blocked while the calendar draft has blocking warnings');
assert.match(proposalPanel, /buildProposalSignature\(proposal\.proposals\)/, 'Stored drafts must be scoped to the original proposal signature');

assert.match(proposalCalendar, /Reparto del día/, 'PlanningProposalCalendar must use direct operational wording');
assert.match(proposalCalendar, /no se guarda nada hasta guardar el reparto/i, 'PlanningProposalCalendar must explain that edits are not persisted yet');
assert.match(proposalCalendar, /openReassignment/, 'Calendar task cards must open responsible-person editing');
assert.match(proposalCalendar, /Elegir responsable/, 'Reassignment must finish by choosing one valid candidate');
assert.match(proposalCalendar, /Sin asignar/, 'Reassignment must offer an explicit option to leave the task unassigned');
assert.match(proposalCalendar, /proposal\.taskId !== directPlacement\.taskId/, 'Leaving a task unassigned must remove all of its assignments from the draft');
assert.match(
  proposalCalendar,
  /getTaskWorkerPlannedDurationMinutes\(task\)/,
  'Existing multi-worker tasks must render the real per-worker duration instead of the full task duration',
);
assert.match(proposalCalendar, /assignmentRole/, 'Traffic-light labels must use the real building-team role');
assert.match(proposalCalendar, /md:hidden/, 'Calendar must provide a vertical mobile agenda instead of requiring horizontal timeline use');
assert.match(proposalCalendar, /Cambios pendientes/, 'Calendar must summarize manual draft changes');
assert.match(proposalCalendar, /Solape de horario/, 'Calendar must detect and expose draft overlaps');
assert.match(proposalCalendar, /No apta para este edificio/, 'Calendar must block explicit No apta draft assignments');
assert.match(proposalCalendar, /Fuera del equipo habitual/, 'Calendar must warn when a manual assignment leaves the building team');
assert.match(proposalCalendar, /resetDraft/, 'Calendar must allow resetting manual edits back to Hermes proposal');
assert.match(proposalCalendar, /@dnd-kit\/core/, 'Sandbox drag and drop must use the maintained dnd-kit core sensors');
assert.match(proposalCalendar, /validateDraftAssignmentMove/, 'Drag and fallback reassignment must use the shared proposal-engine validator');
assert.match(proposalCalendar, /TouchSensor/, 'Mobile drag must use an explicit touch sensor');
assert.match(proposalCalendar, /KeyboardSensor/, 'Drag and drop must retain a keyboard-accessible sensor');
assert.match(proposalCalendar, /Deshacer/, 'Every successful drag must expose one-interaction undo');
assert.match(proposalCalendar, /Sin cubrir/, 'Unassigned tasks must remain in a visible dedicated tray');
assert.match(
  proposalCalendar,
  /const unassignedTasks = useMemo\([\s\S]*?\.sort\(\(left, right\) => \(left\.propertyCode \|\| left\.property\)\.localeCompare\([\s\S]*?right\.propertyCode \|\| right\.property[\s\S]*?numeric: true[\s\S]*?sensitivity: 'base'/,
  'Uncovered sandbox tasks must be sorted naturally and alphabetically by property code',
);
assert.match(proposalPanel, /effectiveAvailability/, 'The sandbox must receive the same effective availability used by the proposal engine');
assert.match(planningPage, /effectiveAvailability=\{effectiveAvailability\}/, 'Planning page must pass engine availability into the reviewed sandbox');
assert.doesNotMatch(proposalCalendar, /taskStorageService|multipleTaskAssignmentService|supabase\.from/, 'PlanningProposalCalendar must be a local sandbox and must not persist changes directly');

assert.match(planningPage, /const handleSedeChange = \(sede: Sede\) => \{/, 'Planning page must reset invalid filters/proposal when sede changes');
assert.match(planningPage, /setFilters\(defaultFilters\)/, 'Changing sede must reset planning filters');
assert.match(planningPage, /onSedeChange=\{handleSedeChange\}/, 'PlanningFilters must use the sede-change wrapper');
assert.match(planningPage, /const handleRefresh = \(\) => \{/, 'Planning page must centralize refresh behavior');
assert.match(planningPage, /buildingDataQuery\.refetch\(\)/, 'Refresh must retry building/team data as well as planning data');
assert.match(planningPage, /isLoading=\{isLoading \|\| buildingDataQuery\.isLoading\}/, 'Start screen must receive the combined loading state');
assert.match(planningPage, /filteredCleanerDays\.length === 0 \?/, 'Detailed cleaner section needs an actionable empty state when filters hide all workers');
assert.doesNotMatch(planningPage, /xl:max-h-\[calc\(100vh-2rem\)\] xl:overflow-y-auto/, 'Planning page must not create nested scrolling in the right rail');
assert.match(planningPage, /proposalState \? \([\s\S]*<AssignmentProposalPanel[\s\S]*\) : \([\s\S]*<PlanningStartScreen/s, 'Proposal and start screen must be mutually exclusive views');
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

// DnD sandbox contract: keep interaction, validation and responsive safeguards explicit.
assert.match(planningPage, /effectiveAvailability=\{effectiveAvailability\}/, 'Planning page must pass effective availability into proposal review');
assert.match(proposalPanel, /effectiveAvailability=\{effectiveAvailability\}/, 'Proposal panel must pass effective availability into the calendar');
assert.match(proposalCalendar, /DndContext/, 'Proposal calendar must own the local dnd-kit context');
assert.match(proposalCalendar, /KeyboardSensor/, 'Proposal DnD must remain keyboard accessible');
assert.match(proposalCalendar, /TouchSensor[\s\S]*delay: 300[\s\S]*tolerance: 8/, 'Touch drag must use a deliberate long-press activation with movement tolerance');
assert.match(proposalCalendar, /data-dnd-handle/, 'Proposed and uncovered cards must expose a dedicated drag handle');
assert.match(proposalCalendar, /data-dnd-handle[\s\S]*touch-none/, 'The dedicated drag handle must reserve the gesture instead of scrolling the page');
assert.doesNotMatch(proposalCalendar, /data-dnd-handle[\s\S]*touch-pan-y/, 'The drag handle must not authorize vertical browser scrolling');
assert.match(proposalCalendar, /<DndContext[\s\S]*autoScroll=\{false\}/, 'Starting a calendar drag must not auto-scroll or shift the current viewport');
assert.match(proposalCalendar, /data-dnd-mobile-destinations[\s\S]*max-\[400px\]:block/, 'Narrow mobile drag must reveal explicit destination drop zones');
assert.match(proposalCalendar, /data-dnd-unassigned-tray-item/, 'Uncovered tasks must remain in their own draggable tray');
assert.match(proposalCalendar, /availableCleanerIds[\s\S]*availability\.date === selectedDate[\s\S]*availability\.isAvailable[\s\S]*availability\.remainingMinutes > 0/, 'Sandbox columns must identify workers with real remaining availability on the selected date');
assert.match(proposalCalendar, /visibleCleanerIds[\s\S]*dayItems[\s\S]*availableCleanerIds/, 'Sandbox must retain workers with assigned blocks while adding available empty workers');
assert.match(proposalCalendar, /visibleCleaners\.length === 0[\s\S]*visibleCleaners\.map/, 'Desktop sandbox must render only visible workers instead of every active worker');
assert.doesNotMatch(proposalCalendar, /\) : cleaners\.map\(\(cleaner\) =>/, 'Desktop sandbox must not reserve columns for every active worker');
assert.match(proposalCalendar, /validateDraftAssignmentMove/, 'Every DnD and fallback reassignment must use proposal-engine validation');
assert.doesNotMatch(proposalCalendar, /reassignmentCandidates[\s\S]*\.filter\(\(candidate\) => candidate\.validation\.valid\)/, 'Manual placement must not hide active workers merely because engine rules recommend against them');
assert.match(proposalCalendar, /Colocar tarea/, 'Dropping or selecting a task must open a manual placement dialog');
assert.match(proposalCalendar, /getDropStartMinute/, 'Timeline drops must convert the final pointer position into a start minute');
assert.match(proposalCalendar, /getActivatorClientY/, 'Timeline DnD must read the real mouse or touch activation coordinate');
assert.match(proposalCalendar, /activatorClientY \+ delta\.y/, 'Timeline DnD must derive the final pointer from activation coordinate plus DnD movement');
assert.doesNotMatch(proposalCalendar, /active\.rect\.current\.translated\?\.top/, 'Timeline DnD must not infer the dropped time from the draggable handle top edge');
assert.match(proposalCalendar, /Math\.max\(timelineStartMinute, Math\.min\(timelineEndMinute, snappedMinute\)\)/, 'Dropped times must stay inside the visible timeline bounds');
assert.match(proposalCalendar, /SNAP_MINUTES = 15/, 'Timeline drops must snap direct placement to practical 15-minute intervals');
assert.match(proposalCalendar, /QUARTER_HOUR_GRID_SIZE = SNAP_MINUTES \* PIXELS_PER_MINUTE/, 'Visible quarter-hour grid must share the exact scale used by drag snapping');
assert.match(proposalCalendar, /data-quarter-hour-grid/, 'Each worker timeline must expose a visible 15-minute placement grid');
assert.match(proposalCalendar, /backgroundSize: `100% \$\{QUARTER_HOUR_GRID_SIZE\}px, 100% \$\{60 \* PIXELS_PER_MINUTE\}px`/, 'Worker columns must draw quarter-hour subdivisions plus stronger hourly lines');
assert.match(proposalCalendar, /type DragMoveEvent/, 'Timeline DnD must track pointer movement while a task is selected');
assert.match(proposalCalendar, /onDragMove=\{handleDragMove\}/, 'Timeline DnD must update its hovered quarter-hour continuously');
assert.match(proposalCalendar, /data-dnd-quarter-hover/, 'Timeline DnD must render one explicit quarter-hour hover indicator');
assert.match(proposalCalendar, /height: QUARTER_HOUR_GRID_SIZE/, 'The hover indicator must cover exactly one 15-minute grid block');
assert.doesNotMatch(proposalCalendar, /\$\{isOver \? 'ring-4' : ''\}/, 'Desktop timeline DnD must not highlight the entire worker column');
assert.match(proposalCalendar, /handleDragEnd[\s\S]*applyPlacement\([\s\S]*fromMinutes\(dropStartMinute\)/, 'Dropping on a worker timeline must apply the responsible person and dropped time immediately');
assert.doesNotMatch(proposalCalendar, /handleDragEnd[\s\S]*setReassignment\(\{ taskId: payload\.taskId, proposalIndex: payload\.proposalIndex \}\)/, 'Timeline drag must not open the placement dialog after drop');
assert.match(proposalCalendar, /Hora de inicio/, 'Manual placement must allow choosing the start time');
assert.match(proposalCalendar, /type="time"/, 'Manual placement start must use a native time input');
assert.match(proposalCalendar, /Aplicar como excepción/, 'Manual placement must allow overriding soft engine conflicts explicitly');
assert.match(proposalCalendar, /manualOverrideWarnings/, 'Overridden engine conflicts must remain attached to the draft as operational warnings');
assert.match(proposalCalendar, /title: 'Excepción manual'[\s\S]*message,/, 'Manual override reasons must remain visible in the reviewed draft');
assert.match(proposalCalendar, /severity: 'warning',[\s\S]*title: 'Solape de horario'/, 'A consciously chosen manual overlap must warn without blocking final approval');
assert.match(proposalCalendar, /Excepción permitida/, 'Non-recommended drag destinations must be shown as allowed exceptions, not rejected destinations');
assert.match(proposalCalendar, /No apta para este edificio/, 'Explicit No apta exclusions must remain blocking');
assert.match(proposalCalendar, /proposedStartTime: directStartTime/, 'The selected or dropped start time must be written into the draft proposal');
assert.match(proposalCalendar, /proposedEndTime: fromMinutes\(toMinutes\(directStartTime\) \+ durationMinutes\)/, 'The manual end time must be calculated from selected or dropped start plus real task duration');
assert.match(proposalCalendar, /assignmentRole:[\s\S]*proposedStartTime: directStartTime[\s\S]*durationMinutes,[\s\S]*capacityAfterAssignment:/, 'Manual moves must copy role, selected times, duration and capacity into the draft');
assert.doesNotMatch(proposalCalendar, /sourceCleanerId === cleanerId/, 'Dropping on the same worker must still allow changing its time block');
assert.match(proposalCalendar, /isStale[\s\S]*Regenera antes de mover/, 'Stale proposals must block drag mutations');
assert.match(proposalCalendar, />Deshacer<\//, 'Successful moves must expose one-click undo');
assert.doesNotMatch(proposalCalendar, /droppable[^\n]*unassigned|dropId=\{`unassigned/i, 'Assigned cards must not be droppable back to uncovered');

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
