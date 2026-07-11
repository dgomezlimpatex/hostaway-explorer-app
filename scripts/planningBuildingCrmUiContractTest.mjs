import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
const exists = (relativePath) => existsSync(join(root, relativePath));

const appRoutes = read('src/App.tsx');
const hooks = read('src/hooks/useOperationalPlanning.ts');
const service = read('src/services/planning/operationalPlanningService.ts');
const propertyGroupsPage = read('src/components/property-groups/PropertyGroupsPage.tsx');
const propertyGroupDetails = read('src/components/property-groups/PropertyGroupDetails.tsx');
const propertyGroupStorage = read('src/services/storage/propertyGroupStorage.ts');
const planningTaskCard = read('src/components/cleaning-planning/PlanningTaskCard.tsx');
const desktopSidebar = read('src/components/dashboard/DashboardSidebar.tsx');
const mobileSidebar = read('src/components/dashboard/MobileDashboardSidebar.tsx');
const roleBasedNavigation = read('src/components/navigation/RoleBasedNavigation.tsx');
const workflowGuide = read('src/components/cleaning-planning/PlanningWorkflowGuide.tsx');
const operationalTypes = read('src/types/operationalPlanning.ts');

const requiredFiles = [
  'src/pages/PlanningBuildingsIndex.tsx',
  'src/pages/PlanningBuildingDetail.tsx',
  'src/components/planning/building-crm/BuildingCrmPage.tsx',
  'src/components/planning/building-crm/BuildingCrmHeader.tsx',
  'src/components/planning/building-crm/BuildingCrmKpis.tsx',
  'src/components/planning/building-crm/BuildingDemandCalendar.tsx',
  'src/components/planning/building-crm/BuildingDecisionList.tsx',
  'src/components/planning/building-crm/BuildingTeamPanel.tsx',
  'src/components/planning/building-crm/BuildingPropertiesPanel.tsx',
  'src/components/planning/building-crm/BuildingSetupChecklist.tsx',
  'src/components/planning/building-crm/BuildingTeamEditor.tsx',
  'src/components/planning/building-crm/BuildingAssignmentProposalPanel.tsx',
  'src/components/planning/building-crm/BuildingDataEditor.tsx',
  'src/services/planning/buildingCrmAggregator.ts',
];

for (const file of requiredFiles) {
  assert.ok(exists(file), `Missing building CRM implementation file: ${file}`);
}

const page = read('src/components/planning/building-crm/BuildingCrmPage.tsx');
const buildingsIndex = read('src/pages/PlanningBuildingsIndex.tsx');
const header = read('src/components/planning/building-crm/BuildingCrmHeader.tsx');
const kpis = read('src/components/planning/building-crm/BuildingCrmKpis.tsx');
const calendar = read('src/components/planning/building-crm/BuildingDemandCalendar.tsx');
const decisions = read('src/components/planning/building-crm/BuildingDecisionList.tsx');
const team = read('src/components/planning/building-crm/BuildingTeamPanel.tsx');
const teamEditor = read('src/components/planning/building-crm/BuildingTeamEditor.tsx');
const properties = read('src/components/planning/building-crm/BuildingPropertiesPanel.tsx');
const setupChecklist = read('src/components/planning/building-crm/BuildingSetupChecklist.tsx');
const assignmentPanel = read('src/components/planning/building-crm/BuildingAssignmentProposalPanel.tsx');
const buildingDataEditor = read('src/components/planning/building-crm/BuildingDataEditor.tsx');

assert.match(operationalTypes, /export interface PlanningBuildingCrmProfile/, 'Types must define PlanningBuildingCrmProfile');
assert.match(operationalTypes, /PlanningBuildingCrmSummary/, 'Types must define summary contract');
assert.match(operationalTypes, /PlanningBuildingCrmDecision/, 'Types must define decision contract');
assert.match(service, /getBuildingCrmProfile\(input: \{[\s\S]*propertyGroupId: string[\s\S]*dateFrom: string[\s\S]*dateTo: string/s, 'operationalPlanningService must expose getBuildingCrmProfile');
assert.match(service, /loadMonthlyReservationForecastItems\([\s\S]*activeProperties[\s\S]*activeTasks/s, 'Building CRM service must reuse reservation forecast items');
assert.match(hooks, /buildingCrm: \(sedeId\?: string, propertyGroupId\?: string, dateFrom\?: string, dateTo\?: string\)/, 'React Query keys must include building CRM scope');
assert.match(hooks, /useOperationalPlanningBuildingCrm/, 'Hook must expose useOperationalPlanningBuildingCrm');
assert.match(appRoutes, /PlanningBuildingsIndex/, 'App must lazy-load PlanningBuildingsIndex');
assert.match(appRoutes, /PlanningBuildingDetail/, 'App must lazy-load PlanningBuildingDetail');
assert.match(appRoutes, /path="\/planning\/buildings"[\s\S]*requiredModule="tasks" requiredAction="canEdit"[\s\S]*<PlanningBuildingsIndex \/>/, 'Route /planning/buildings must exist behind tasks/canEdit, not propertyGroups');
assert.match(appRoutes, /path="\/planning\/buildings\/:propertyGroupId"[\s\S]*requiredModule="tasks" requiredAction="canEdit"[\s\S]*<PlanningBuildingDetail \/>/, 'Route /planning/buildings/:propertyGroupId must exist behind tasks/canEdit');

const detailPage = readFileSync('src/pages/PlanningBuildingDetail.tsx', 'utf8');
assert.doesNotMatch(detailPage, /useOperationalPlanningBuildingCrm/, 'Simplified building detail must not depend on planning forecasts');
assert.doesNotMatch(detailPage, /rangeDays|formatMadridDate|addDays/, 'Simplified building detail must not retain a hidden planning range');
assert.match(detailPage, /usePropertyGroups/, 'Simplified building detail must load building master data directly');
assert.match(detailPage, /usePropertyAssignments/, 'Simplified building detail must load assigned properties directly');
assert.match(detailPage, /useCleanerAssignments/, 'Simplified building detail must load assigned personnel directly');

assert.match(page, /BuildingCrmHeader/, 'Building detail must render its compact navigation header');
assert.match(page, /useCleaners/, 'Building detail must load active cleaners for direct team editing');
assert.match(page, /data-building-main-block="data"[\s\S]*<BuildingDataEditor/, 'The first main block must be building data');
assert.match(page, /data-building-main-block="team"[\s\S]*<BuildingTeamEditor/, 'The second main block must be assigned staff');
assert.match(page, /data-building-main-block="properties"[\s\S]*<BuildingPropertiesPanel/, 'The third main block must be building properties');
assert.equal((page.match(/data-building-main-block=/g) || []).length, 3, 'Building detail must expose exactly three main content blocks');
assert.doesNotMatch(page, /BuildingCrmKpis|BuildingSetupChecklist|BuildingAssignmentProposalPanel|BuildingDemandCalendar|BuildingDecisionList|BuildingTeamPanel/, 'Forecast, proposals, decisions and duplicate summaries must leave the main building view');
assert.doesNotMatch(page, /buildBuildingCrmAssignmentProposal|setAssignmentProposal|rangeOptions/, 'Building detail must not calculate planning previews in the simplified view');
assert.match(header, /Planificación[\s\S]*Próximamente/, 'Header must expose future planning access without building the page');
assert.match(header, /disabled/, 'Future planning access must remain disabled');
assert.doesNotMatch(header, /\/planning\?building=/, 'Future building planning access must not reuse the current global planner route');
assert.match(buildingsIndex, /Buscar edificio por nombre, código, zona o cliente/, 'Buildings index must keep one practical search field');
assert.doesNotMatch(buildingsIndex, /setupStats|Orden recomendado de trabajo|Total edificios|Configurar primero|Listos para probar|Abrir Hermes Planificación/, 'Buildings index must remove dashboards, instructions and duplicate planning links');
assert.match(buildingsIndex, /Ver edificio/, 'Building cards must expose one clear detail action');
assert.match(buildingsIndex, /Añadir edificio/, 'Buildings index must expose the create-building action');
assert.match(buildingsIndex, /Nombre del edificio[\s\S]*Código interno[\s\S]*Check-out[\s\S]*Check-in/s, 'Building creation must request operational identity and whole-building schedule');
assert.match(buildingsIndex, /propertyGroupStorage\.createPropertyGroup/, 'Building creation must use canonical property-group storage');
assert.match(buildingsIndex, /El check-in debe ser posterior al check-out/, 'Building creation must reject invalid operational windows');
assert.match(buildingsIndex, /navigate\(`\/planning\/buildings\/\$\{created\.id\}`\)/, 'After creation, the user must continue in the new building profile');
assert.match(buildingsIndex, /useCleaningPlanningBuildingData/, 'Buildings index must reuse planning building data, not planning-settings access');
assert.match(buildingsIndex, /\/planning\/buildings\/\$\{group\.id\}/, 'Buildings index must link every building to its CRM detail');
assert.match(buildingsIndex, /propertyCount === 0[\s\S]*teamCount === 0[\s\S]*excludedCount === 0/s, 'Buildings index must only enable deletion for completely empty buildings');
assert.match(buildingsIndex, /Eliminar edificio vacío/, 'Empty building cards must expose an explicit delete action');
assert.match(buildingsIndex, /¿Eliminar[\s\S]*no se puede deshacer/s, 'Deleting a building must require irreversible-action confirmation');
assert.match(buildingsIndex, /propertyGroupStorage\.deleteEmptyPropertyGroup/, 'Building deletion must use the guarded canonical property-group storage service');
assert.match(buildingsIndex, /await refetch\(\)/, 'Building deletion must refresh the operational index after success');
assert.match(propertyGroupStorage, /deleteEmptyPropertyGroup/, 'Property-group storage must expose guarded empty-building deletion');
assert.match(propertyGroupStorage, /property_group_assignments[\s\S]*cleaner_group_assignments/s, 'Guarded deletion must recheck both property and cleaner relationships in Supabase');
assert.match(propertyGroupStorage, /No se puede eliminar[\s\S]*propiedades o equipo/s, 'Guarded deletion must reject non-empty buildings with an operational error');
assert.match(propertyGroupStorage, /createPropertyGroup[\s\S]*ilike\('internal_code'[\s\S]*Ya existe otro edificio con ese código interno/s, 'Building creation must reject duplicate internal codes case-insensitively');
assert.match(propertyGroupStorage, /ilike\('internal_code'[\s\S]*Ya existe otro edificio con ese código interno/s, 'Building updates must reject duplicate internal codes');
assert.match(buildingDataEditor, /Datos del edificio/, 'Building profile must expose its editable master data');
assert.match(buildingDataEditor, /Nombre[\s\S]*Código interno[\s\S]*Check-out[\s\S]*Check-in/s, 'Building editor must expose identity and whole-building schedule fields');
assert.match(buildingDataEditor, /propertyGroupStorage\.updatePropertyGroup/, 'Building editor must persist through canonical property-group storage');
assert.match(buildingDataEditor, /checkOutTime[\s\S]*checkInTime/s, 'Building editor must save checkout and checkin times');
assert.match(buildingDataEditor, /invalidateQueries\(\{ queryKey: \['cleaning-planning-building-data'\]/, 'Saving building data must immediately refresh the buildings index cache');
assert.match(buildingDataEditor, /El check-in debe ser posterior al check-out/, 'Building editor must reject an invalid operational window');
assert.match(buildingDataEditor, /Eliminar edificio/, 'Building profile must preserve the guarded delete capability');
assert.match(buildingDataEditor, /details[\s\S]*Acciones avanzadas[\s\S]*Eliminar edificio/s, 'Destructive building actions must live under advanced disclosure');
assert.match(buildingDataEditor, /propertyGroupStorage\.deleteEmptyPropertyGroup/, 'Building deletion must keep the guarded storage check');
assert.match(buildingDataEditor, /propiedades[\s\S]*equipo[\s\S]*No aptas/s, 'Delete area must explain the relationships that block deletion');
assert.match(header, /Todos los edificios/, 'Header must link back to the operational buildings index');
assert.match(teamEditor, /Personal asignado/, 'The second block must use the requested plain-language title');
assert.match(teamEditor, /Añadir trabajadora/, 'Team editor must allow adding workers directly');
assert.match(teamEditor, /Editar[\s\S]*Quitar/s, 'Team editor must allow editing and removing existing building assignments');
assert.match(teamEditor, /Titular[\s\S]*Suplente[\s\S]*Backup[\s\S]*No apta/s, 'Team editor must expose titulares, suplentes, backups and No apta roles');
assert.match(teamEditor, /useAssignCleanerToGroup[\s\S]*useUpdateCleanerAssignment[\s\S]*useRemoveCleanerFromGroup/s, 'Team editor must persist through the canonical property-group assignment mutations');
assert.match(teamEditor, /No entra en propuestas automáticas/, 'Team editor must explain that No apta workers are excluded from proposals');
assert.match(properties, /Duración/, 'Properties panel must show duration');
assert.match(properties, /Necesita/, 'Properties panel must show required cleaners/personas');
assert.match(properties, /Editar propiedad/, 'Properties panel must provide a settings/edit link without inline editing');
assert.match(setupChecklist, /Personalización del edificio/, 'Setup checklist must frame building customization explicitly');
assert.match(setupChecklist, /Propiedades y duración[\s\S]*Equipo habitual[\s\S]*Propuesta revisable/s, 'Setup checklist must guide the three setup steps');
assert.match(setupChecklist, /Editar equipo \/ No aptas/, 'Setup checklist must expose building team and No apta editing path');
assert.match(setupChecklist, /href="#building-team-editor"/, 'Setup checklist team CTA must jump to the in-page team editor');
assert.doesNotMatch(setupChecklist, /to="\/planning-settings"/, 'Setup checklist must not send building team editing back to legacy planning settings');
assert.match(setupChecklist, /Hermes no debe inventar horas/, 'Setup checklist must reinforce missing-duration safety');
assert.match(assignmentPanel, /Proponer asignación/, 'Building assignment panel must expose a proposal CTA');
assert.match(assignmentPanel, /No guarda cambios/, 'Building assignment panel must make review-only behavior clear');
assert.match(assignmentPanel, /Necesitan decisión manual/, 'Building assignment panel must show conflicts separately');
assert.match(assignmentPanel, /Ver en planificación/, 'Building assignment panel must send final application to Hermes planning flow');

assert.match(desktopSidebar, /title: 'Edificios'[\s\S]*href: '\/planning\/buildings'[\s\S]*permission: 'tasks-edit'/, 'Desktop sidebar must expose Edificios with tasks-edit permission');
assert.match(mobileSidebar, /title: 'Edificios'[\s\S]*href: '\/planning\/buildings'[\s\S]*permission: 'tasks-edit'/, 'Mobile sidebar must expose Edificios with tasks-edit permission');
assert.match(roleBasedNavigation, /to="\/planning\/buildings"[\s\S]*title="Edificios"/, 'Control panel must expose Edificios for planning users');
assert.match(workflowGuide, /Personalizar edificios/, 'Hermes planning workflow guide must include an explicit building access CTA');
assert.match(workflowGuide, /to="\/planning\/buildings"/, 'Hermes planning building CTA must point to operational buildings index');

assert.match(propertyGroupsPage, /\/planning\/buildings\/\$\{group\.id\}/, 'PropertyGroupsPage must link each group to building CRM');
assert.match(propertyGroupDetails, /\/planning\/buildings\/\$\{group\.id\}/, 'PropertyGroupDetails must link selected group to building CRM');
assert.match(planningTaskCard, /task\.detectedBuilding\?\.propertyGroupId/, 'Planning task cards must expose building CRM link when a building is detected');
assert.match(planningTaskCard, /Ver ficha edificio/, 'Planning task cards must use the requested building CRM wording');

console.log('planning-building-crm-ui-contract-tests: OK');
